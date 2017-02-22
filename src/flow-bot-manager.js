import { FlowStorage } from 'flow-storage';
import FlowTemplate from 'flow-template';
import builder from 'botbuilder';
import { FlowRenderFactory } from 'flow-render-factory';
import path from 'path';
import FlowRequireManager from 'flow-require-manager';

class BotManager {
  constructor(settings) {
    this.settings = settings || {};
    this.observers = {};
    this.createStorage();
    this.createTemplate();
    this.createConnector();
    this.createBot();
    this.createObservers();
    this.createRenderFactory();
    this.cardManager = new FlowRequireManager({ logger: settings.logger, pattern: '*.json' });
    this.createCards(function(err) {
      if (err) {
        this.log('error', err);
      }
    }.bind(this));
  }

  log(level, message) {
    if (this.settings.logger) {
      this.settings.logger.log(level, message);
    }
  }

  createStorage() {
    this.storage = this.settings.storage || new FlowStorage();
    delete this.settings['storage'];
  }

  createTemplate() {
    if (!this.settings.template) {
      let opts = {
        localesPath: this.settings.localesPath,
        defaultLocale: this.settings.defaultLocale
      };
      this.settings.template = new FlowTemplate(opts);
    }
    this.template = this.settings.template;
    delete this.settings['template'];
  }

  createConnector() {
    if (this.settings.connector) {
      return this.connector = this.settings.connector;
    }
    let botAppId = this.settings.botAppId || process.env.BOT_APP_ID;
    let pass = this.settings.botAppPassword || process.env.BOT_APP_PASSWORD;
    this.connector = new builder.ChatConnector({
      appId: botAppId,
      appPassword: pass
    });
  }

  createBot() {
    this.bot = new builder.UniversalBot(this.connector);
  }

  observeEvent(name, message) {
    if (this.observers[name]) {
      for (let observer in this.observers[name]) {
        observer(message);
      }
    }
  }

  createObservers() {
    let eventNames = ['contactRelationUpdate', 'deleteUserData', 'message', 'ping', 'typing', 'conversationUpdate'];
    for (let eventName in eventNames) {
      this.bot.on(eventName, this.observeEvent.bind(this,eventName));
    }
  }

  createRenderFactory() {
    this.renderFactory = new FlowRenderFactory({ template: this.template, builder: builder });
  }

  getAbsolutePath(relative) {
    return path.normalize(path.join(process.cwd(),relative));
  }

  createCards(cb) {
    this.log('info', 'Loading card from folder');
    if (this.settings.cardPath) {
      this.log('info', `Loading card from folder ${this.settings.cardPath}`);
      this.cardManager.addFolder(this.settings.cardPath, cb);
    } else {
      this.log('info', 'No card folder defined');
      cb();
    }
  }

  addObserver(eventName, fn) {
    if (!this.observers[eventName]) {
      this.observers[eventName] = [];
    }
    this.observers[eventName].push(fn);
  }

  getVariables(session, args, next) {
    this.storage.getAllFromCollection('user', session.message.address.user.id, function(err, values) {
      session.view = {};
      session.view.user = values;
      next();
    });
  }

  sendCard(name, session, args, next) {
    let card = this.cardManager.getItem(name);
    let locale = 'en';
    if (session.view && session.view.user && session.view.user.locale) {
      locale = session.view.user.locale;
    }
    card = this.template.translate(card, locale, session.view);
    session.send(card);
    next();
  }

}

export default BotManager;
