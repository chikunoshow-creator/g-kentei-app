class GKenteiMasterApp {
  constructor() {
    this.storageKeys = {
      wrongIds: 'gkentei_wrong_ids',
      stats: 'gkentei_question_stats',
      historySnapshots: 'gkentei_snapshots',
      learnedTerms: 'gkentei_terms_learned'
    };

    this.currentMainTab = 'quiz';
    this.currentMode = 'random';
    this.cardFrontMode = 'term';
    this.activeQuestions = [];
    this.currentIndex = 0;
    this.score = 0;
    this.isAnswered = false;
    this.sessionAnswers = [];

    this.initDOM();
    this.updateHomeStats();
    
    // 安全に描画
    setTimeout(() => {
      this.renderTermsList();
    }, 100);
  }

  initDOM() {
    this.tabSections = {
      quiz: document.getElementById('section-quiz'),
      terms: document.getElementById('section-terms')
    };
    this.tabButtons = {
      quiz: document.getElementById('tab-btn-quiz'),
      terms: document.getElementById('tab-btn-terms')
    };
    this.screens = {
      home: document.getElementById('screen-home'),
      quiz: document.getElementById('screen-quiz'),
      result: document.getElementById('screen-result')
    };
    this.toastEl = document.getElementById('toast');
  }

  showToast(message) {
    if (!this.toastEl) return;
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    setTimeout(() => this.toastEl.classList.remove('show'), 2500);
  }

  // ==================== タブ切り替え ====================
  switchMainTab(tabName) {
    this.currentMainTab = tabName;
    if (tabName === 'quiz') {
      this.tabSections.quiz?.classList.remove('hidden');
      this.tabSections.terms?.classList.add('hidden');
      this.tabButtons.quiz?.classList.add('active');
      this.tabButtons.terms?.classList.remove('active');
      this.updateHomeStats();
    } else {
      this.tabSections.quiz?.classList.add('hidden');
      this.tabSections.terms?.classList.remove('hidden');
      this.tabButtons.quiz?.classList.remove('active');
      this.tabButtons.terms?.classList.add('active');
      this.renderTermsList();
    }
  }

  // ==================== 安全なデータ取得（★ここを修正！） ====================
  getQuestions() {
    try {
      if (typeof QUESTIONS !== 'undefined') return QUESTIONS;
    } catch (e) {}
    return [];
  }

  getTerms() {
    try {
      if (typeof TERMS !== 'undefined') return TERMS;
    } catch (e) {}
    return [];
  }

  getWrongIds() {
    const data = localStorage.getItem(this.storageKeys.wrongIds);
    return data ? JSON.parse(data) : [];
  }

  saveWrongId(id) {
    const ids = new Set(this.getWrongIds());
    ids.add(id);
    localStorage.setItem(this.storageKeys.wrongIds, JSON.stringify([...ids]));
  }

  removeWrongId(id) {
    const ids = new Set(this.getWrongIds());
    ids.delete(id);
    localStorage.setItem(this.storageKeys.wrongIds, JSON.stringify([...ids]));
  }

  getStats() {
    const data = localStorage.getItem(this.storageKeys.stats);
    return data ? JSON.parse(data) : {};
  }

  recordAnswerStats(questionId, isCorrect) {
    const stats = this.getStats();
    if (!stats[questionId]) {
      stats[questionId] = { answered: 0, correct: 0, rate: 0, status: 'insufficient' };
    }

    const item = stats[questionId];
    item.answered += 1;
    if (isCorrect) item.correct += 1;
    item.rate = Math.round((item.correct / item.answered) * 100);

    if (item.answered < 2) {
      item.status = 'insufficient';
    } else if (item.rate >= 80) {
      item.status = 'master';
    } else if (item.rate >= 60) {
      item.status = 'review';
    } else {
      item.status = 'weak';
    }

    localStorage.setItem(this.storageKeys.stats, JSON.stringify(stats));
  }

  saveSessionSnapshot() {
    const snapshots = JSON.parse(localStorage.getItem(this.storageKeys.historySnapshots) || '[]');
    const sessionData = {
      timestamp: new Date().toISOString(),
      mode: this.currentMode,
      score: this.score,
      total: this.activeQuestions.length,
      answers: this.sessionAnswers
    };
    snapshots.unshift(sessionData);
    if (snapshots.length > 50) snapshots.pop();
    localStorage.setItem(this.storageKeys.historySnapshots, JSON.stringify(snapshots));
  }

  clearWrongHistory() {
    if (confirm('学習履歴・成績データをすべてリセットしますか？')) {
      localStorage.removeItem(this.storageKeys.wrongIds);
      localStorage.removeItem(this.storageKeys.stats);
      localStorage.removeItem(this.storageKeys.historySnapshots);
      this.updateHomeStats();
      this.showToast('学習履歴をリセットしました');
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
    Object.values(this.screens).forEach(el => el?.classList.add('hidden'));
    this.screens[screenName]?.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  updateHomeStats() {
    const questions = this.getQuestions();
    const stats = this.getStats();
    let weakCount = 0;
    let masterCount = 0;
    let answeredCount = 0;

    Object.keys(stats).forEach(id => {
      answeredCount++;
      if (stats[id].status === 'weak') weakCount++;
      if (stats[id].status === 'master') masterCount++;
    });

    const poolEl = document.getElementById('total-pool-count');
    if (poolEl) poolEl.textContent = questions.length;
    document.getElementById('stat-weak-count').textContent = weakCount;
    document.getElementById('stat-master-count').textContent = masterCount;
    document.getElementById('stat-answered-count').textContent = `${answeredCount}/${questions.length}`;

    const wrongCount = this.getWrongIds().length;
    const reviewBtn = document.getElementById('btn-review');
    if (reviewBtn) {
      reviewBtn.textContent = wrongCount === 0 ? '❌ 復習するミス問題はありません' : `❌ 直近ミス問題を復習 (${wrongCount}問)`;
      reviewBtn.style.opacity = wrongCount === 0 ? '0.5' : '1';
    }

    const weakBtn = document.getElementById('btn-weak');
    if (weakBtn) {
      weakBtn.textContent = weakCount === 0 ? '⚠️ 苦手特訓 (該当なし)' : `⚠️ 苦手特訓モード (${weakCount}問)`;
      weakBtn.style.opacity = weakCount === 0 ? '0.5' : '1';
    }
  }

  showHome() {
    this.updateHomeStats();
    this.switchScreen('home');
  }

  // ==================== クイズ出題 ====================
  startQuiz(mode) {
    const questions = this.getQuestions();
    this.currentMode = mode;
    this.currentIndex = 0;
    this.score = 0;
    this.sessionAnswers = [];

    if (mode === 'random') {
      const shuffled = [...questions].sort(() => 0.5 - Math.random());
      this.activeQuestions = shuffled.slice(0, 10);
    } else if (mode === 'wrong') {
      const wrongIds = this.getWrongIds();
      if (wrongIds.length === 0) {
        alert('現在、復習対象の問題はありません！');
        return;
      }
      this.activeQuestions = questions.filter(q => wrongIds.includes(q.id));
    } else if (mode === 'weak') {
      const stats = this.getStats();
      const weakIds = Object.keys(stats)
        .filter(id => stats[id].status === 'weak')
        .map(id => Number(id));

      if (weakIds.length === 0) {
        alert('正答率60%未満の「苦手問題」は現在ありません！素晴らしいです！');
        return;
      }
      this.activeQuestions = questions.filter(q => weakIds.includes(q.id));
    }

    this.switchScreen('quiz');
    this.renderQuestion();
  }

  renderQuestion() {
    this.isAnswered = false;
    const q = this.activeQuestions[this.currentIndex];
    const total = this.activeQuestions.length;

    let modeText = '⚡️ ランダム演習';
    if (this.currentMode === 'wrong') modeText = '❌ ミス問題復習';
    if (this.currentMode === 'weak') modeText = '⚠️ 苦手特訓演習';

    document.getElementById('quiz-mode-label').textContent = modeText;
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
      id: q.id,
      question: q.question,
      options: q.options,
      selectedIndex: selectedIndex,
      correctIndex: q.answer,
      isCorrect: isCorrect,
      explanation: q.explanation
    });

    this.recordAnswerStats(q.id, isCorrect);

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
      if (this.currentMode === 'wrong') {
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
    this.saveSessionSnapshot();
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
    if (reviewBtn) reviewBtn.style.display = wrongIds.length > 0 ? 'block' : 'none';

    this.renderReviewList();
  }

  renderReviewList() {
    const container = document.getElementById('review-list-container');
    if (!container) return;
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

  generateAITextReport() {
    const total = this.activeQuestions.length;
    const rate = Math.round((this.score / total) * 100);
    const badges = ['A', 'B', 'C', 'D'];

    let report = `【G検定 演習結果レポート】\n`;
    report += `モード: ${this.currentMode}\n`;
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

    report += `\n----------------------\n※苦手分野の分析とアドバイスをお願いします！`;
    return report;
  }

  async copyResultForAI() {
    const text = this.generateAITextReport();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      this.showToast('📋 コピー完了！ AIに貼り付けてね');
    } catch (err) {
      alert('コピーに失敗しました。');
    }
  }

  async shareResultForAI() {
    const text = this.generateAITextReport();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'G検定 演習結果レポート', text: text });
      } catch (err) {}
    } else {
      this.copyResultForAI();
    }
  }

  // ==================== 【B】単語帳 ====================
  getLearnedTermIds() {
    const data = localStorage.getItem(this.storageKeys.learnedTerms);
    return data ? JSON.parse(data) : [];
  }

  toggleTermLearned(termId, event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const ids = new Set(this.getLearnedTermIds());
    if (ids.has(termId)) {
      ids.delete(termId);
    } else {
      ids.add(termId);
    }
    localStorage.setItem(this.storageKeys.learnedTerms, JSON.stringify([...ids]));
    this.renderTermsList();
  }

  toggleCardMode() {
    this.cardFrontMode = (this.cardFrontMode === 'term') ? 'meaning' : 'term';
    const labelEl = document.getElementById('terms-mode-label');
    if (labelEl) {
      labelEl.textContent = (this.cardFrontMode === 'term')
        ? 'モード: 【表】用語 ➔ 【裏】意味'
        : 'モード: 【表】意味 ➔ 【裏】用語';
    }
    this.renderTermsList();
  }

  renderTermsList() {
    const terms = this.getTerms();
    const searchKeyword = (document.getElementById('terms-search-input')?.value || '').trim().toLowerCase();
    const chapterFilter = document.getElementById('terms-chapter-filter')?.value || 'all';
    const statusFilter = document.getElementById('terms-status-filter')?.value || 'all';

    const learnedIds = new Set(this.getLearnedTermIds());
    const container = document.getElementById('terms-card-list');
    if (!container) return;

    container.innerHTML = '';

    const filtered = terms.filter(t => {
      const matchKeyword = t.term.toLowerCase().includes(searchKeyword) || t.meaning.toLowerCase().includes(searchKeyword);
      const matchChapter = chapterFilter === 'all' || String(t.chapter) === chapterFilter;
      const isLearned = learnedIds.has(t.id);
      const matchStatus = statusFilter === 'all' || (statusFilter === 'learned' && isLearned) || (statusFilter === 'unlearned' && !isLearned);
      return matchKeyword && matchChapter && matchStatus;
    });

    const countInfo = document.getElementById('terms-count-info');
    if (countInfo) countInfo.textContent = `表示中: ${filtered.length} / 全${terms.length}語`;
    const learnRate = terms.length > 0 ? Math.round((learnedIds.size / terms.length) * 100) : 0;
    const progInfo = document.getElementById('terms-progress-info');
    if (progInfo) progInfo.textContent = `習得率: ${learnRate}% (${learnedIds.size}/${terms.length})`;

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px 0;">一致する用語が見つかりません</div>`;
      return;
    }

    filtered.forEach(item => {
      const isLearned = learnedIds.has(item.id);
      const frontTitle = (this.cardFrontMode === 'term') ? item.term : item.meaning;
      const frontIsMeaning = (this.cardFrontMode === 'meaning');
      const backTitle = (this.cardFrontMode === 'term') ? item.meaning : item.term;
      const backIsMeaning = (this.cardFrontMode === 'term');

      const wrapper = document.createElement('div');
      wrapper.className = `flashcard-wrapper ${isLearned ? 'is-learned' : ''}`;
      
      wrapper.onclick = () => {
        wrapper.classList.toggle('flipped');
      };

      wrapper.innerHTML = `
        <div class="flashcard-inner">
          <div class="flashcard-face flashcard-front">
            <div class="card-top-row">
              <span class="term-chapter-badge">第${item.chapter}章</span>
              <span class="side-label">【表面】</span>
              <button class="term-learn-btn" onclick="app.toggleTermLearned(${item.id}, event)">
                ${isLearned ? '⭐️' : '☆'}
              </button>
            </div>
            <div class="card-center-text ${frontIsMeaning ? 'meaning-style' : ''}">${frontTitle}</div>
            <div class="card-bottom-row">
              <span>🔄 タップで裏面を見る</span>
            </div>
          </div>

          <div class="flashcard-face flashcard-back">
            <div class="card-top-row">
              <span class="term-chapter-badge">第${item.chapter}章</span>
              <span class="side-label">【裏面：答え】</span>
              <button class="term-learn-btn" onclick="app.toggleTermLearned(${item.id}, event)">
                ${isLearned ? '⭐️' : '☆'}
              </button>
            </div>
            <div class="card-center-text ${backIsMeaning ? 'meaning-style' : ''}">${backTitle}</div>
            <div class="card-bottom-row">
              <span>🔄 タップで表面に戻す</span>
            </div>
          </div>
        </div>
      `;

      container.appendChild(wrapper);
    });
  }
}

// グローバル展開
window.app = new GKenteiMasterApp();