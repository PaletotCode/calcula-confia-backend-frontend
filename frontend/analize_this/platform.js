(function(){
  'use strict';
  const TOKEN_KEY = 'cc_token';
  const RETURNING_KEY = 'cc_isReturningUser';
  const LIFETIME_KEY = 'cc_lifetime_access';
  const PLATFORM_LOOP_KEY = 'cc_platform_redirect_meta';
  const REDIRECT_FLAG_KEY = 'cc_redirected_to_platform';

  function readEnv() {
    try {
      const el = document.getElementById('env-config');
      if (el && el.textContent) {
        const parsed = JSON.parse(el.textContent);
        return parsed || {};
      }
    } catch (_) {}
    return {};
  }

  const ENV = readEnv();
  const DEFAULT_API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:8000/api/v1'
    : 'https://calculaconfia-production.up.railway.app/api/v1';
  const API_BASE = ENV.NEXT_PUBLIC_API_URL || ENV.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API;

  function redirectHome() {
    window.location.replace('/');
  }

  function clearStoredSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(RETURNING_KEY);
      localStorage.removeItem(LIFETIME_KEY);
    } catch (_) {}
  }

  (function gatePlatformAccess(){
  try { sessionStorage.removeItem(PLATFORM_LOOP_KEY); } catch(_){}
    try { sessionStorage.removeItem(REDIRECT_FLAG_KEY); } catch(_){}
    // DESABILITADO: A verificação CSP estava causando o loop
    // A autenticação já foi validada no land_page.js antes do redirecionamento
    console.log('Platform auth check disabled to prevent CSP loop');
  })();

  document.addEventListener('DOMContentLoaded', () => {
              // Função para inicializar ícones com retry
              function initIcons() {
                try { 
                  if (window.lucide && window.lucide.createIcons) {
                    window.lucide.createIcons();
                    console.log('Lucide icons initialized');
                  } else {
                    // Retry após 100ms se lucide ainda não carregou
                    setTimeout(initIcons, 100);
                  }
                } catch (e) { 
                  console.warn('Error initializing icons:', e);
                }
              }
              
              // Tentar imediatamente e também após load
              initIcons();
              window.addEventListener('load', initIcons);

              // Logout handler (Sair)
              const $logout = document.getElementById('logout-btn-platform');
              if ($logout) {
                  $logout.addEventListener('click', async (e) => {
                      e.preventDefault();
          try {
                        await fetch(API_BASE + '/logout', {
                            method: 'POST',
                            credentials: 'include'
                        });
                    } catch (_) {}
                      clearStoredSession();
                      window.location.replace('/');
                  });
              }

              // --- MÓDULO DE ESTADO DA APLICAÇÃO ---
              const State = {
                  currentCalculatorStep: 0,
                  selectedBillCount: 0,
                  billData: [],
                
                  resetCalculatorState() {
                      this.currentCalculatorStep = 0;
                      this.selectedBillCount = 0;
                      this.billData = [];
                  },

                  setBillCount(count) {
                      this.selectedBillCount = count;
                      const existingData = [...this.billData];
                      this.billData = Array(count).fill(null).map((_, i) => existingData[i] || {});
                  },

                  updateBillData(index, field, value) {
                      if (this.billData[index]) {
                          this.billData[index][field] = value;
                      }
                  }
              };

              // --- MÓDULO DE UTILIDADES ---
              const Utils = {
                  get: (selector) => document.querySelector(selector),
                  getAll: (selector) => document.querySelectorAll(selector),
                  create: (tag, options = {}) => {
                      const el = document.createElement(tag);
                      Object.entries(options).forEach(([key, value]) => {
                          if (key === 'className') el.className = value;
                          else if (key === 'innerHTML') el.innerHTML = value;
                          else if (key === 'dataset') Object.entries(value).forEach(([dataKey, dataValue]) => el.dataset[dataKey] = dataValue);
                          else el.setAttribute(key, value);
                      });
                      return el;
                  },
                  escapeHTML(str) {
                      if (!str) return '';
                      return str.replace(/[&<>'"]/g, tag => ({
                          '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
                      }[tag]));
                  }
              };
            
              // --- MÓDULO DA UI DA CALCULADORA ---
              const CalculatorUI = {
                  elements: {
                      container: Utils.get('#calculate-container'),
                      formStepsContainer: Utils.get('#form-steps-container'),
                      billOptionsGrid: Utils.get('#bill-options-grid'),
                      recommendationAlert: Utils.get('#recommendation-alert'),
                      summaryContainer: Utils.get('#summary-details'),
                      loadingTimeline: Utils.get('#loading-timeline'),
                      resultValue: Utils.get('#result-value-display'),
                  },
                
                  init() {
                      this.renderBillOptions();
                      this.addEventListeners();
                      this.setupWelcomeParticles();
                  },

                  renderBillOptions() {
                      if (!this.elements.billOptionsGrid) return;
                      this.elements.billOptionsGrid.innerHTML = '';
                      for (let i = 1; i <= 12; i++) {
                          const card = Utils.create('button', {
                              className: 'bill-option-card flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-xl cursor-pointer',
                              dataset: { count: i },
                              innerHTML: `<i data-lucide="file-text" class="w-6 h-6 sm:w-8 sm:h-8 pointer-events-none"></i><span class="text-lg sm:text-xl font-bold pointer-events-none">${i}</span>`
                          });
                          this.elements.billOptionsGrid.appendChild(card);
                      }
                      lucide.createIcons();
                  },
                
                  setupWelcomeParticles() {
                      const welcomeBg = Utils.get('#welcome-bg');
                      if (welcomeBg && welcomeBg.children.length === 0) {
                          for (let i = 0; i < 25; i++) { // Reduzido de 50 para 25
                              const particle = Utils.create('div', { className: 'particle' });
                              const size = Math.random() * 3 + 1;
                              particle.style.cssText = `width:${size}px; height:${size}px; left:${Math.random()*100}%; animation-duration:${Math.random()*5+8}s; animation-delay:${Math.random()*5}s;`;
                              welcomeBg.appendChild(particle);
                          }
                      }
                  },

                  addEventListeners() {
                      this.elements.container.addEventListener('click', this.handleContainerClick.bind(this));
                      this.elements.billOptionsGrid?.addEventListener('click', this.handleBillSelection.bind(this));
                      Utils.get('#accept-recommendation-btn')?.addEventListener('click', () => this.startFormFlow(3));
                      Utils.get('#continue-anyway-btn')?.addEventListener('click', () => this.startFormFlow(State.selectedBillCount));
                  },

                  handleContainerClick(e) {
                      const button = e.target.closest('button');
                      if (!button) return;

                      const action = button.dataset.action || button.id;
                      switch (action) {
                          case 'start-calculation-btn': this.goToStep(1); break;
                          case 'back-to-welcome-btn': this.goToStep(0); break;
                          case 'go-back-form': this.goToStep(State.currentCalculatorStep - 1); break;
                          case 'go-next-form': this.handleFormNavigation(button); break;
                          case 'start-calculation-premium-btn': this.startLoadingAnimation(); break;
                          case 'restart': App.resetCalculatorAndStartOver(); break;
                          case 'view-summary': Utils.get('a[href="#history"]').click(); break;
                      }
                  },
                
                  handleBillSelection(e) {
                      const card = e.target.closest('.bill-option-card');
                      if (!card) return;
                      const count = parseInt(card.dataset.count, 10);
                      State.selectedBillCount = count; 
                      this.elements.recommendationAlert.classList.add('hidden');
                      if (count <= 2) {
                          this.elements.recommendationAlert.classList.remove('hidden');
                          this.elements.recommendationAlert.classList.add('shake');
                          setTimeout(() => this.elements.recommendationAlert.classList.remove('shake'), 500);
                      } else {
                          this.startFormFlow(count);
                      }
                  },

                  startFormFlow(billCount) {
                      State.setBillCount(billCount);
                      this.elements.formStepsContainer.innerHTML = '';
                    
                      for (let i = 0; i < billCount; i++) {
                          const formStep = this.createFormStepElement(i);
                          this.elements.formStepsContainer.appendChild(formStep);
                      }

                      App.updateAllStepsNodeList();
                      lucide.createIcons();
                    
                      const firstFormIndex = Array.from(App.elements.allCalcSteps).indexOf(this.elements.formStepsContainer.firstChild);
                      this.goToStep(firstFormIndex);
                  },

                  createFormStepElement(index) {
                      const billNumber = index + 1;
                      const totalBills = State.selectedBillCount;
                      const bill = State.billData[index] || {};

                      const step = Utils.create('div', {
                          className: 'calculator-step bg-white form-step',
                          innerHTML: `
                              <button class="back-btn" data-action="go-back-form"><i data-lucide="arrow-left" class="w-6 h-6 text-slate-600"></i></button>
                              <div class="w-full max-w-4xl h-full mx-auto flex flex-col justify-center items-center pb-24 overflow-y-auto p-4">
                                  <div class="w-full h-full flex flex-col md:flex-row gap-8 md:gap-12 items-center justify-center">

                                      <!-- FORM CONTAINER -->
                                      <div class="w-full md:w-1/2 order-2 md:order-1 text-center md:text-left flex flex-col justify-center">
                                          <h2 class="text-2xl sm:text-3xl font-bold text-text-dark">Fatura ${billNumber} de ${totalBills}</h2>
                                          <p class="text-slate-500 mt-2 mb-6 text-sm sm:text-base">Preencha os dados desta fatura. As informações são salvas automaticamente.</p>
                                          <div class="input-group">
                                              <i data-lucide="calendar" class="input-icon"></i>
                                              <input type="text" placeholder="Data da Fatura" class="input-field" data-field="date" value="${Utils.escapeHTML(bill.date || '')}">
                                          </div>
                                          <div class="input-group mt-4">
                                              <i data-lucide="receipt" class="input-icon"></i>
                                              <input type="text" placeholder="Valor do ICMS (R$)" class="input-field" data-field="icms" value="${Utils.escapeHTML(bill.icms || '')}">
                                          </div>
                                          <button data-action="go-next-form" class="mt-6 calculate-btn-premium w-full py-3 font-semibold rounded-lg text-lg">${billNumber === totalBills ? 'Finalizar e Confirmar' : 'Próxima Fatura'}</button>
                                          <div class="form-error-message text-red-600 text-sm mt-4 h-5"></div>
                                      </div>
                                    
                                      <!-- CAROUSEL CONTAINER -->
                                      <div class="w-full md:w-1/2 order-1 md:order-2 mt-8 md:mt-0">
                                           <p class="md:hidden text-sm font-semibold text-slate-600 mb-2 text-center">Dicas Rápidas:</p>
                                           <div class="carousel-container aspect-video md:aspect-square">
                                              <div class="carousel-track">
                                                  <div class="carousel-slide"><img src="https://placehold.co/400x300/e2e8f0/64748b?text=Onde+encontrar+o+ICMS%3F" alt="[Imagem de Dica sobre ICMS na fatura]">
                                                      <p class="font-semibold mt-2 text-sm sm:text-base">Onde encontrar o ICMS?</p>
                                                      <p class="text-xs sm:text-sm text-slate-600">Procure na seção "Detalhes de Faturamento" ou "Tributos" da sua conta de luz.</p>
                                                  </div>
                                                  <div class="carousel-slide"><img src="https://placehold.co/400x300/e2e8f0/64748b?text=Preencha+o+valor+exato" alt="[Imagem de Dica sobre preenchimento de valor]">
                                                      <p class="font-semibold mt-2 text-sm sm:text-base">Preencha o valor exato</p>
                                                      <p class="text-xs sm:text-sm text-slate-600">Use a vírgula para centavos, como no exemplo: 45,78.</p>
                                                  </div>
                                                  <div class="carousel-slide"><img src="https://placehold.co/400x300/e2e8f0/64748b?text=Data+de+Vencimento" alt="[Imagem de Dica sobre data da fatura]">
                                                      <p class="font-semibold mt-2 text-sm sm:text-base">Use a Data de Vencimento</p>
                                                      <p class="text-xs sm:text-sm text-slate-600">A data de vencimento ou de emissão pode ser usada como referência.</p>
                                                  </div>
                                              </div>
                                              <div class="carousel-dots"></div>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          `
                      });

                      const dateInput = step.querySelector('[data-field="date"]'); 
                      flatpickr(dateInput, {
                          dateFormat: "d/m/Y",
                          altInput: true,
                          altFormat: "d de F, Y",
                          locale: "pt"
                      });

                      this.initMasks(step);
                      this.initCarousel(step.querySelector('.carousel-container'));

                      step.querySelectorAll('.input-field').forEach(input => {
                          input.addEventListener('input', (e) => State.updateBillData(index, e.target.dataset.field, e.target.value));
                      });

                      return step;
                  },

                  initMasks(container) {
                       container.querySelectorAll('[data-field="icms"]').forEach(el => {
                         if (window.IMask) {
                           IMask(el, { mask: Number, scale: 2, thousandsSeparator: '.', padFractionalZeros: true, normalizeZeros: true, radix: ',' });
                         }
                       });
                  },
                  initCarousel(carouselEl) {
                      if (!carouselEl) return;
                      const track = carouselEl.querySelector('.carousel-track');
                      const dotsContainer = carouselEl.querySelector('.carousel-dots');
                      const slides = Array.from(track.children);
                      let currentIndex = 0;
                      let intervalId;

                      dotsContainer.innerHTML = '';
                      slides.forEach((_, i) => {
                          const dot = Utils.create('button', { className: 'carousel-dot', dataset: { index: i } });
                          dotsContainer.appendChild(dot);
                      });

                      const dots = Array.from(dotsContainer.children);

                      const updateCarousel = () => {
                          track.style.transform = `translateX(-${currentIndex * 100}%)`;
                          dots.forEach((dot, i) => dot.classList.toggle('active', i === currentIndex));
                      };

                      const startAutoPlay = () => {
                          clearInterval(intervalId);
                          intervalId = setInterval(() => {
                              currentIndex = (currentIndex + 1) % slides.length;
                              updateCarousel();
                          }, 5000);
                      };
                    
                      dotsContainer.addEventListener('click', (e) => {
                          if (e.target.matches('.carousel-dot')) {
                              currentIndex = parseInt(e.target.dataset.index, 10);
                              updateCarousel();
                              startAutoPlay();
                          }
                      });

                      updateCarousel();
                      startAutoPlay();
                  },

                  handleFormNavigation(button) {
                      const currentForm = button.closest('.form-step');
                      const errorMsgEl = currentForm.querySelector('.form-error-message');
                      const inputs = currentForm.querySelectorAll('.input-field');
                      let allFieldsValid = true;
                    
                      inputs.forEach(input => {
                          input.classList.remove('border-red-500');
                          const value = input.value.trim();
                          if (value === '') {
                              allFieldsValid = false;
                              input.classList.add('border-red-500');
                          } else if (input.dataset.field === 'icms' && (isNaN(parseFloat(value.replace(',', '.'))) || parseFloat(value.replace(',', '.')) <= 0)) {
                              allFieldsValid = false;
                              input.classList.add('border-red-500');
                          }
                      });

                      if (!allFieldsValid) {
                          errorMsgEl.textContent = 'Por favor, preencha todos os campos.';
                          currentForm.classList.add('shake');
                          setTimeout(() => currentForm.classList.remove('shake'), 500);
                          return;
                      }
                    
                      errorMsgEl.textContent = '';
                      const formSteps = Array.from(this.elements.formStepsContainer.children);
                      const currentFormIndex = formSteps.indexOf(currentForm);
                    
                      const isLastForm = currentFormIndex === formSteps.length - 1;

                      if(isLastForm) {
                          this.populateConfirmationScreen();
                      }
                      this.goToStep(State.currentCalculatorStep + 1);
                  },

                  populateConfirmationScreen() {
                      this.elements.summaryContainer.innerHTML = ''; 
                      if (State.billData.length === 0) {
                          this.elements.summaryContainer.innerHTML = `<p class="text-slate-500 text-center">Nenhum dado de fatura encontrado.</p>`;
                          return;
                      }
                      State.billData.forEach((data, index) => {
                          const item = Utils.create('div', {
                              className: 'summary-item border-b border-slate-200 pb-3 mb-3 last:border-b-0 last:pb-0 last:mb-0',
                              innerHTML: `
                                  <p class="font-bold text-md text-slate-700">Fatura ${index + 1}</p>
                                  <div class="flex justify-between items-center mt-1 text-slate-600 text-sm">
                                      <span>Data da Fatura:</span>
                                      <strong class="font-medium text-slate-800">${Utils.escapeHTML(data.date) || 'N/A'}</strong>
                                  </div>
                                  <div class="flex justify-between items-center mt-1 text-slate-600 text-sm">
                                      <span>Valor do ICMS:</span>
                                      <strong class="font-medium text-slate-800">R$ ${Utils.escapeHTML(data.icms) || 'N/A'}</strong>
                                  </div>
                              `
                          });
                          this.elements.summaryContainer.appendChild(item);
                      });
                  },

                  startLoadingAnimation() {
                      const timelineItems = [
                          { text: "Analisando padrões de tributação...", icon: "file-search-2" },
                          { text: "Cruzando dados com a legislação vigente...", icon: "scale" },
                          { text: "Calculando correção monetária retroativa...", icon: "calendar-clock" },
                          { text: "Estimando juros da taxa Selic...", icon: "trending-up" },
                          { text: "Compilando seu relatório final...", icon: "check-circle" }
                      ];

                      this.elements.loadingTimeline.innerHTML = '';
                      timelineItems.forEach(item => {
                          this.elements.loadingTimeline.appendChild(Utils.create('div', {
                              className: 'timeline-item',
                              innerHTML: `
                                  <div class="timeline-content flex items-center gap-3">
                                      <i data-lucide="${item.icon}" class="loader-icon w-6 h-6 text-slate-400"></i>
                                      <span class="text-lg">${item.text}</span>
                                  </div>`
                          }));
                      });
                      lucide.createIcons();

                      this.goToStep(Array.from(App.elements.allCalcSteps).indexOf(Utils.get('#loading-step')));

                      const items = Utils.getAll('.timeline-item');
                      let currentIndex = 0;

                      const processNextItem = () => {
                          if (currentIndex < items.length) {
                              if (currentIndex > 0) {
                                  items[currentIndex - 1].classList.add('completed');
                                  const prevIcon = items[currentIndex - 1].querySelector('i');
                                  if(prevIcon) prevIcon.dataset.lucide = 'check-circle';
                              }
                              items[currentIndex].classList.add('active');
                              const currentIcon = items[currentIndex].querySelector('i');
                              if(currentIcon) currentIcon.dataset.lucide = 'loader-2';
                            
                              lucide.createIcons();
                            
                              currentIndex++;
                              setTimeout(processNextItem, 1500 + Math.random() * 500);
                          } else {
                               items[currentIndex - 1].classList.add('completed');
                               const prevIcon = items[currentIndex - 1].querySelector('i');
                               if(prevIcon) prevIcon.dataset.lucide = 'check-circle';
                               lucide.createIcons();
                               // Fim da animação
                               setTimeout(() => {
                                   this.goToStep(Array.from(App.elements.allCalcSteps).indexOf(Utils.get('#result-step')));
                               }, 1000);
                          }
                      };
                      processNextItem();
                  },

                  goToStep(index) {
                      if (index < 0 || index >= App.elements.allCalcSteps.length) return;
                      App.elements.allCalcSteps[State.currentCalculatorStep]?.classList.remove('active');
                      App.elements.allCalcSteps[index]?.classList.add('active');
                      State.currentCalculatorStep = index;
                  }
              };

              const App = {
                  elements: {
                      pageContainer: Utils.get('#page-container'),
                      navLinks: Utils.getAll('.nav-link[data-index]'),
                      navIndicator: Utils.get('#nav-indicator'),
                      allCalcSteps: Utils.getAll('.calculator-step'),
                  },
                
                  init() {
                      this.setupNavigation();
                      CalculatorUI.init();
                  },

                  updateAllStepsNodeList() {
                      this.elements.allCalcSteps = Utils.getAll('.calculator-step');
                  },

                  setupNavigation() {
                      this.elements.navLinks.forEach(link => {
                          link.addEventListener('click', (e) => {
                              e.preventDefault();
                              this.elements.pageContainer.style.transform = `translateX(${link.dataset.index * -25}%)`;
                              this.updateActiveLink(link);
                          });
                      });
                      this.updateActiveLink(this.elements.navLinks[0]);
                  },

                  updateActiveLink(activeLink) {
                      if (!activeLink) return;
                      this.elements.navLinks.forEach(link => {
                          const content = link.querySelector('div');
                          if (content) {
                              content.classList.remove('text-primary-accent');
                              content.classList.add('text-slate-300');
                              content.style.color = '';
                          }
                      });
                      const activeContent = activeLink ? activeLink.querySelector('div') : null;
                      if (activeContent) {
                          activeContent.classList.add('text-primary-accent');
                          activeContent.style.color = activeLink.dataset.color;
                          activeContent.classList.remove('text-slate-300');
                      }
                      this.moveIndicator(activeLink);
                  },
                  moveIndicator(activeLink) {
                       const linkWidth = activeLink.offsetWidth;
                      const linkLeft = activeLink.offsetLeft;
                      const activeColor = activeLink.dataset.color || '#0d9488';
                      this.elements.navIndicator.style.width = `${linkWidth - 16}px`;
                      this.elements.navIndicator.style.left = `${linkLeft + 8}px`;
                      document.documentElement.style.setProperty('--active-indicator-color', activeColor);
                  },
                
                  resetCalculatorAndStartOver() {
                      State.resetCalculatorState();
                      CalculatorUI.elements.formStepsContainer.innerHTML = '';
                      this.updateAllStepsNodeList();
                      CalculatorUI.renderBillOptions(); // Re-render bill options to reset any selections.
                      CalculatorUI.goToStep(1); // Go to selection screen
                  }
              };

              App.init();
          });
})();