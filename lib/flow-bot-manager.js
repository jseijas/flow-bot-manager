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
    this.dialogManager = new _flowRequireManager2.default({ logger: settings.logger, pattern: '*.flow' });
    this.createCards(function (err) {
      if (err) {
        this.log('error', err);
      }
      this.log('now will load actions');
      this.createActions(function (err) {
        if (err) {
          this.log('error', err);
        }
        this.createDialogs(function (err) {
          if (err) {
            this.log('error', err);
          }
          this.buildDialogs();
        }.bind(this));
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
    key: 'createDialogs',
    value: function createDialogs(cb) {
      this.log('info', 'Loading dialogs from folder');
      if (this.settings.dialogPath) {
        this.log('info', 'Loading dialogs from folder ' + this.settings.dialogPath);
        this.dialogManager.addFolder(this.settings.dialogPath, cb);
      } else {
        this.log('info', 'No dialog folder defined');
        cb();
      }
    }
  }, {
    key: 'parseFlow',
    value: function parseFlow(str) {
      var lines = str.text.split('\n');
      var result = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line === '') {
          continue;
        }
        var item = {};
        var tokens = line.split('->');
        item.name = tokens[0].trim();
        item.flow = [];
        if (tokens.length === 1) {
          var cardName = tokens[0].substring(1).trim();
          if (cardName === '') {
            cardName = 'root';
          }
          item.flow.push(cardName);
        } else {
          tokens = tokens[1].split(',');
          for (var j = 0; j < tokens.length; j++) {
            item.flow.push(tokens[j].trim());
          }
        }
        result.push(item);
      }
      return result;
    }
  }, {
    key: 'buildItemDialog',
    value: function buildItemDialog(item) {
      var actionArr = [];
      actionArr.push(this.getVariables.bind(this));
      for (var i = 0; i < item.flow.length; i++) {
        var current = item.flow[i].trim();
        if (current !== '') {
          if (current[0] === '/') {
            actionArr.push(this.beginDialog.bind(this, current));
          } else if (current.endsWith('()')) {
            current = current.substring(0, current.length - 2);
            var action = this.actionManager.getItem(current);
            actionArr.push(action.method.bind(this));
          } else {
            actionArr.push(this.sendCard.bind(this, current));
          }
        }
      }
      actionArr.push(this.endDialog.bind(this));
      var finalName = item.name === 'root' ? '/' : item.name;
      if (!finalName.startsWith('/')) {
        finalName = '/' + finalName;
      }
      this.bot.dialog(finalName, actionArr);
      this.log('info', 'Built dialog ' + finalName);
    }
  }, {
    key: 'buildDialogs',
    value: function buildDialogs() {
      this.log('info', 'building dialogs');
      for (var name in this.dialogManager.items) {
        var item = this.dialogManager.items[name];
        if (item.flow) {
          item.name = name;
          this.buildItemDialog(item);
        } else {
          var items = this.parseFlow(item);
          for (var i = 0; i < items.length; i++) {
            this.buildItemDialog(items[i]);
          }
        }
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
      session.view = {};
      session.view.message = session.message;
      this.storage.getAllFromCollection('user', session.message.address.user.id, function (err, values) {
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
  }, {
    key: 'endDialog',
    value: function endDialog(session, args, next) {
      session.endDialog();
    }
  }, {
    key: 'beginDialog',
    value: function beginDialog(name, session, args, next) {
      session.beginDialog(name);
    }
  }]);

  return BotManager;
}();

exports.default = BotManager;