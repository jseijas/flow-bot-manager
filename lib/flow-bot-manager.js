'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _flowStorage = require('flow-storage');

var _flowTemplate = require('flow-template');

var _flowTemplate2 = _interopRequireDefault(_flowTemplate);

var _botbuilder = require('botbuilder');

var _botbuilder2 = _interopRequireDefault(_botbuilder);

var _flowRenderFactory = require('flow-render-factory');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _flowRequireManager = require('flow-require-manager');

var _flowRequireManager2 = _interopRequireDefault(_flowRequireManager);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var BotManager = function () {
  function BotManager(settings) {
    _classCallCheck(this, BotManager);

    this.settings = settings || {};
    this.observers = {};
    this.createStorage();
    this.createTemplate();
    this.createConnector();
    this.createBot();
    this.createObservers();
    this.createRenderFactory();
    this.cardManager = new _flowRequireManager2.default({ logger: settings.logger, pattern: '*.json' });
    this.actionManager = new _flowRequireManager2.default({ logger: settings.logger, pattern: '*.js' });
    this.createCards(function (err) {
      if (err) {
        this.log('error', err);
      }
      this.log('now will load actions');
      this.createActions(function (err) {
        if (err) {
          this.log('error', err);
        }
      }.bind(this));
    }.bind(this));
  }

  _createClass(BotManager, [{
    key: 'log',
    value: function log(level, message) {
      if (this.settings.logger) {
        this.settings.logger.log(level, message);
      }
    }
  }, {
    key: 'createStorage',
    value: function createStorage() {
      this.storage = this.settings.storage || new _flowStorage.FlowStorage();
      delete this.settings['storage'];
    }
  }, {
    key: 'createTemplate',
    value: function createTemplate() {
      if (!this.settings.template) {
        var opts = {
          localesPath: this.settings.localesPath,
          defaultLocale: this.settings.defaultLocale
        };
        this.settings.template = new _flowTemplate2.default(opts);
      }
      this.template = this.settings.template;
      delete this.settings['template'];
    }
  }, {
    key: 'createConnector',
    value: function createConnector() {
      if (this.settings.connector) {
        return this.connector = this.settings.connector;
      }
      var botAppId = this.settings.botAppId || process.env.BOT_APP_ID;
      var pass = this.settings.botAppPassword || process.env.BOT_APP_PASSWORD;
      this.connector = new _botbuilder2.default.ChatConnector({
        appId: botAppId,
        appPassword: pass
      });
    }
  }, {
    key: 'createBot',
    value: function createBot() {
      this.bot = new _botbuilder2.default.UniversalBot(this.connector);
    }
  }, {
    key: 'observeEvent',
    value: function observeEvent(name, message) {
      if (this.observers[name]) {
        for (var observer in this.observers[name]) {
          observer(message);
        }
      }
    }
  }, {
    key: 'createObservers',
    value: function createObservers() {
      var eventNames = ['contactRelationUpdate', 'deleteUserData', 'message', 'ping', 'typing', 'conversationUpdate'];
      for (var eventName in eventNames) {
        this.bot.on(eventName, this.observeEvent.bind(this, eventName));
      }
    }
  }, {
    key: 'createRenderFactory',
    value: function createRenderFactory() {
      this.renderFactory = new _flowRenderFactory.FlowRenderFactory({ template: this.template, builder: _botbuilder2.default });
    }
  }, {
    key: 'getAbsolutePath',
    value: function getAbsolutePath(relative) {
      return _path2.default.normalize(_path2.default.join(process.cwd(), relative));
    }
  }, {
    key: 'createCards',
    value: function createCards(cb) {
      this.log('info', 'Loading cards from folder');
      if (this.settings.cardPath) {
        this.log('info', 'Loading card from folder ' + this.settings.cardPath);
        this.cardManager.addFolder(this.settings.cardPath, cb);
      } else {
        this.log('info', 'No card folder defined');
        cb();
      }
    }
  }, {
    key: 'createActions',
    value: function createActions(cb) {
      this.log('info', 'Loading actions from folder');
      if (this.settings.actionPath) {
        this.log('info', 'Loading action from folder ' + this.settings.actionPath);
        this.actionManager.addFolder(this.settings.actionPath, cb);
      } else {
        this.log('info', 'No action folder defined');
        cb();
      }
    }
  }, {
    key: 'addObserver',
    value: function addObserver(eventName, fn) {
      if (!this.observers[eventName]) {
        this.observers[eventName] = [];
      }
      this.observers[eventName].push(fn);
    }
  }, {
    key: 'getVariables',
    value: function getVariables(session, args, next) {
      this.storage.getAllFromCollection('user', session.message.address.user.id, function (err, values) {
        session.view = {};
        session.view.user = values;
        next();
      });
    }
  }, {
    key: 'sendCard',
    value: function sendCard(name, session, args, next) {
      var card = this.cardManager.getItem(name);
      var locale = 'en';
      if (session.view && session.view.user && session.view.user.locale) {
        locale = session.view.user.locale;
      }
      card = this.renderFactory.render(session, card, locale, session.view);
      session.send(card);
      next();
    }
  }]);

  return BotManager;
}();

exports.default = BotManager;