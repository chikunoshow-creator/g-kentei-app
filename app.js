class QuizApp {
  constructor() {
    this.storageKey = 'gkentei_wrong_ids';
    this.currentMode = 'random';
    this.activeQuestions = [];
    this.currentIndex = 0;
    this.score = 0;
    this.isAnswered = false;
    this.sessionAnswers = [];

    this.initDOM();
    this.updateHomeStats();
  }

  initDOM() {
    this.screens = {
      home: document.getElementById('screen-home'),
      quiz: document.getElementById('screen-quiz'),
      result: document.getElementById('screen-result')
    };
    this.toastEl = document.getElementById('toast');
  }

  showToast(message) {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 2500);
  }

  getWrongIds() {
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  saveWrongId(id) {
    const ids = new Set(this.getWrongIds());
    ids.add(id);
    localStorage.setItem(this.storageKey, JSON.stringify([...ids]));
  }

  removeWrongId(id) {
    const ids = new Set(this.getWrongIds());
    ids.delete(id);
    localStorage.setItem(this.storageKey, JSON.stringify([...ids]));
  }

  clearWrongHistory() {
    if (confirm('間違えた問題の履歴をリセットしてもよろしいですか？')) {
      localStorage.removeItem(this.storageKey);
      this.updateHomeStats();
    }
  }

  async forceUpdateApp() {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    alert('最新のキャッシュを再読み込みします！');
    window.location.reload(true);
  }

  switchScreen(screenName) {
    Object.values(this.screens).forEach(el => el.classList.add('hidden'));
    this.screens[screenName].classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  updateHomeStats() {
    document.getElementById('total-pool-count').textContent = QUESTIONS.length;
    const wrongCount = this.getWrongIds().length;
    document.getElementById('wrong-count').textContent = wrongCount;

    const reviewBtn = document.getElementById('btn-review');
    if (wrongCount === 0) {
      reviewBtn.style.opacity = '0.5';
      reviewBtn.textContent = '📝 復習する問題はありません';
    } else {
      reviewBtn.style.opacity = '1';
      reviewBtn.textContent = `📝 間違えた問題を復習する (${wrongCount}問)`;
    }
  }

  showHome() {
    this.updateHomeStats();
    this.switchScreen('home');
  }

  startQuiz(mode) {
    this.currentMode = mode;
    this.currentIndex = 0;
    this.score = 0;
    this.sessionAnswers = [];

    if (mode === 'random') {
      const shuffled = [...QUESTIONS].sort(() => 0.5 - Math.random());
      this.activeQuestions = shuffled.slice(0, 10);
    } else if (mode === 'review') {
      const wrongIds = this.getWrongIds();
      if (wrongIds.length === 0) {
        alert('現在、復習対象の問題はありません。完璧です！');
        return;
      }
      this.activeQuestions = QUESTIONS.filter(q => wrongIds.includes(q.id));
    }

    this.switchScreen('quiz');
    this.renderQuestion();
  }

  renderQuestion() {
    this.isAnswered = false;
    const q = this.activeQuestions[this.currentIndex];
    const total = this.activeQuestions.length;

    document.getElementById('quiz-mode-label').textContent = 
      this.currentMode === 'random' ? '⚡️ ランダム演習' : '📝 間違えた問題の復習';
    document.getElementById('quiz-progress-text').textContent = `${this.currentIndex + 1} / ${total}`;
    document.getElementById('quiz-progress-bar').style.width = `${((this.currentIndex + 1) / total) * 100}%`;
    document.getElementById('question-text').textContent = `Q${this.currentIndex + 1}. ${q.question}`;

    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    const badges = ['A', 'B', 'C', 'D'];

    q.options.forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.innerHTML = `<span class="option-badge">${badges[idx]}</span><span>${optText}</span>`;
      btn.onclick = () => this.handleAnswer(idx);
      optionsContainer.appendChild(btn);
    });

    document.getElementById('explanation-container').style.display = 'none';
    document.getElementById('btn-next').classList.add('hidden');
  }

  handleAnswer(selectedIndex) {
    if (this.isAnswered) return;
    this.isAnswered = true;

    const q = this.activeQuestions[this.currentIndex];
    const isCorrect = selectedIndex === q.answer;
    const optionButtons = document.querySelectorAll('.option-btn');

    this.sessionAnswers.push({
      question: q.question,
      options: q.options,
      selectedIndex: selectedIndex,
      correctIndex: q.answer,
      isCorrect: isCorrect,
      explanation: q.explanation
    });

    optionButtons.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === q.answer) {
        btn.classList.add('correct');
      } else if (idx === selectedIndex) {
        btn.classList.add('wrong');
      }
    });

    if (isCorrect) {
      this.score++;
      if (this.currentMode === 'review') {
        this.removeWrongId(q.id);
      }
    } else {
      this.saveWrongId(q.id);
    }

    const expBox = document.getElementById('explanation-container');
    const expJudge = document.getElementById('explanation-judgement');
    const expText = document.getElementById('explanation-text');

    expJudge.textContent = isCorrect ? '正解！ 見事です！' : '不正解… ここで定着させましょう！';
    expJudge.className = `explanation-badge ${isCorrect ? 'correct' : 'wrong'}`;
    expText.style.whiteSpace = 'pre-line';
    expText.textContent = q.explanation;
    expBox.style.display = 'block';

    const nextBtn = document.getElementById('btn-next');
    nextBtn.textContent = (this.currentIndex + 1 >= this.activeQuestions.length) ? '結果を見る →' : '次の問題へ →';
    nextBtn.classList.remove('hidden');
  }

  nextQuestion() {
    this.currentIndex++;
    if (this.currentIndex < this.activeQuestions.length) {
      this.renderQuestion();
    } else {
      this.showResult();
    }
  }

  showResult() {
    this.switchScreen('result');
    const total = this.activeQuestions.length;
    document.getElementById('result-score-text').textContent = `${this.score} / ${total}`;

    let comment = '';
    const rate = this.score / total;
    if (rate === 1) {
      comment = '全問正解！完璧な理解度です！';
    } else if (rate >= 0.7) {
      comment = '合格ライン到達！この調子で進めましょう。';
    } else {
      comment = '間違えた問題をしっかり復習して知識を定着させましょう！';
    }
    document.getElementById('result-comment-text').textContent = comment;

    const wrongIds = this.getWrongIds();
    const reviewBtn = document.getElementById('btn-result-review');
    reviewBtn.style.display = wrongIds.length > 0 ? 'block' : 'none';

    this.renderReviewList();
  }

  renderReviewList() {
    const container = document.getElementById('review-list-container');
    container.innerHTML = '';
    const badges = ['A', 'B', 'C', 'D'];

    this.sessionAnswers.forEach((ans, index) => {
      const item = document.createElement('div');
      item.className = `review-item ${ans.isCorrect ? 'is-correct' : 'is-wrong'}`;

      const userChoiceText = `${badges[ans.selectedIndex]}: ${ans.options[ans.selectedIndex]}`;
      const correctChoiceText = `${badges[ans.correctIndex]}: ${ans.options[ans.correctIndex]}`;

      item.innerHTML = `
        <div class="review-meta">
          <span>Q${index + 1}</span>
          <span class="${ans.isCorrect ? 'badge-correct' : 'badge-wrong'}">
            ${ans.isCorrect ? '⭕️ 正解' : '❌ 不正解'}
          </span>
        </div>
        <div class="review-question-text">${ans.question}</div>
        <div class="review-answer-box">
          <div><strong>あなたの回答:</strong> <span style="color: ${ans.isCorrect ? 'var(--success)' : 'var(--danger)'}">${userChoiceText}</span></div>
          ${!ans.isCorrect ? `<div><strong>正解:</strong> <span style="color: var(--success); font-weight: bold;">${correctChoiceText}</span></div>` : ''}
        </div>
        <div class="review-exp">${ans.explanation}</div>
      `;
      container.appendChild(item);
    });
  }

  // ★AI（かんなさん）に投げる用のテキストを自動生成
  generateAITextReport() {
    const total = this.activeQuestions.length;
    const rate = Math.round((this.score / total) * 100);
    const badges = ['A', 'B', 'C', 'D'];

    let report = `【G検定 演習結果レポート】\n`;
    report += `モード: ${this.currentMode === 'random' ? 'ランダム演習' : '間違えた問題の復習'}\n`;
    report += `スコア: ${this.score} / ${total} 問 (正解率: ${rate}%)\n\n`;
    report += `--- 各問の回答詳細 ---\n`;

    this.sessionAnswers.forEach((ans, idx) => {
      report += `\n[Q${idx + 1}] ${ans.isCorrect ? '⭕️ 正解' : '❌ 不正解'}\n`;
      report += `問題: ${ans.question}\n`;
      report += `回答: ${badges[ans.selectedIndex]}. ${ans.options[ans.selectedIndex]}\n`;
      if (!ans.isCorrect) {
        report += `正解: ${badges[ans.correctIndex]}. ${ans.options[ans.correctIndex]}\n`;
      }
      report += `解説:\n${ans.explanation}\n`;
    });

    report += `\n----------------------\n`;
    report += `※この結果を元に、苦手分野の分析と今後の学習アドバイスをお願いします！`;
    return report;
  }

  // クリップボードへ直接コピー（ファイル保存完全ゼロ！）
  async copyResultForAI() {
    const text = this.generateAITextReport();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // フォールバック
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      this.showToast('📋 コピー完了！ AIに貼り付けてね');
    } catch (err) {
      alert('コピーに失敗しました。ブラウザの共有機能をお試しください。');
    }
  }

  // スマホ標準の共有シートを呼び出す（ファイル保存ゼロ！）
  async shareResultForAI() {
    const text = this.generateAITextReport();
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'G検定 演習結果レポート',
          text: text
        });
      } catch (err) {
        // ユーザーキャンセル時は何もしない
      }
    } else {
      // 非対応環境ならコピーに自動切り替え
      this.copyResultForAI();
    }
  }
}

const app = new QuizApp();