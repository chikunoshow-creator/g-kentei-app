class QuizApp {
  constructor() {
    this.storageKey = 'gkentei_wrong_ids';
    this.currentMode = 'random';
    this.activeQuestions = [];
    this.currentIndex = 0;
    this.score = 0;
    this.isAnswered = false;

    this.initDOM();
    this.updateHomeStats();
  }

  initDOM() {
    this.screens = {
      home: document.getElementById('screen-home'),
      quiz: document.getElementById('screen-quiz'),
      result: document.getElementById('screen-result')
    };
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

  switchScreen(screenName) {
    Object.values(this.screens).forEach(el => el.classList.add('hidden'));
    this.screens[screenName].classList.remove('hidden');
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

    if (mode === 'random') {
      const shuffled = [...QUESTIONS].sort(() => 0.5 - Math.random());
      this.activeQuestions = shuffled.slice(0, 10);
    } else if (mode === 'review') {
      const wrongIds = this.getWrongIds();
      if (wrongIds.length === 0) {
        alert('現在、復習対象の問題はありません！完璧です、ボス。');
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

    expJudge.textContent = isCorrect ? '正解！ お見事です、ボス。' : '不正解… ここで定着させましょう！';
    expJudge.className = `explanation-badge ${isCorrect ? 'correct' : 'wrong'}`;
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
      comment = 'パーフェクト！完璧です、ボス！';
    } else if (rate >= 0.7) {
      comment = '合格ライン突破！素晴らしいペースです。';
    } else {
      comment = '間違えた問題をしっかり復習して定着させましょう！';
    }
    document.getElementById('result-comment-text').textContent = comment;

    const wrongIds = this.getWrongIds();
    const reviewBtn = document.getElementById('btn-result-review');
    reviewBtn.style.display = wrongIds.length > 0 ? 'block' : 'none';
  }
}

// 起動
const app = new QuizApp();