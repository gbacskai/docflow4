// Karma configuration file for Angular 20
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage')
    ],
    client: {
      jasmine: {
        random: true
      },
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/docflow4'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
        { type: 'lcovonly' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome'],
    singleRun: false,
    restartOnFileChange: true,
    
    // Custom launchers for different environments
    customLaunchers: {
      ChromeHeadless: {
        base: 'Chrome',
        flags: [
          '--headless=new',
          '--no-sandbox',
          '--disable-web-security',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--remote-debugging-port=9222',
          '--disable-extensions',
          '--no-first-run'
        ]
      },
      ChromeCI: {
        base: 'Chrome',
        flags: [
          '--headless=new',
          '--no-sandbox',
          '--disable-web-security',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--no-first-run'
        ]
      }
    }
  });
  
  // Override browsers based on environment
  if (process.env.CI || process.env.NODE_ENV === 'ci') {
    config.browsers = ['ChromeCI'];
    config.singleRun = true;
    config.autoWatch = false;
  } else if (process.env.HEADLESS) {
    config.browsers = ['ChromeHeadless'];
    config.singleRun = true;
    config.autoWatch = false;
  }
};