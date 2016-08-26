const Collection = require('../../util/Collection');
const Message = require('../Message');

/**
 * Interface for classes that have text-channel-like features
 * @interface
 */
class TextBasedChannel {

  constructor() {
    /**
     * A Collection containing the messages sent to this channel.
     * @type {Collection<String, Message>}
     */
    this.messages = new Collection();
  }

  /**
   * Bulk delete a given Collection or Array of messages in one go. Returns the deleted messages after.
   * @param {Map<String, Message>|Array<Message>} messages the messages to delete
   * @returns {Collection<String, Message>}
   */
  bulkDelete(messages) {
    if (messages instanceof Map) {
      messages = messages.array();
    }
    if (!(messages instanceof Array)) {
      return Promise.reject('pass an array or map');
    }
    const messageIDs = messages.map(m => m.id);
    return this.client.rest.methods.bulkDeleteMessages(this, messageIDs);
  }
  /**
   * Send a message to this channel
   * @param {String} content the content to send
   * @param {MessageOptions} [options={}] the options to provide
   * @returns {Promise<Message>}
   * @example
   * // send a message
   * channel.sendMessage('hello!')
   *  .then(message => console.log(`Sent message: ${message.content}`))
   *  .catch(console.log);
   */
  sendMessage(content, options = {}) {
    return this.client.rest.methods.sendMessage(this, content, options.tts);
  }
  /**
   * Send a text-to-speech message to this channel
   * @param {String} content the content to send
   * @returns {Promise<Message>}
   * @example
   * // send a TTS message
   * channel.sendTTSMessage('hello!')
   *  .then(message => console.log(`Sent tts message: ${message.content}`))
   *  .catch(console.log);
   */
  sendTTSMessage(content) {
    return this.client.rest.methods.sendMessage(this, content, true);
  }

  /**
   * The parameters to pass in when requesting previous messages from a channel. `around`, `before` and
   * `after` are mutually exclusive. All the parameters are optional.
   * ```js
   * {
   *  limit: 30, // the message limit, defaults to 50
   *  before: '123', // gets messages before the given message ID
   *  after: '123', // gets messages after the given message ID
   *  around: '123', // gets messages around the given message ID
   * }
   * ```
   * @typedef {Object} ChannelLogsQueryOptions
   */

  /**
   * Gets the past messages sent in this channel. Resolves with a Collection mapping message ID's to Message objects.
   * @param {ChannelLogsQueryOptions} [options={}] the query parameters to pass in
   * @returns {Promise<Collection<String, Message>, Error>}
   * @example
   * // get messages
   * channel.getMessages({limit: 10})
   *  .then(messages => console.log(`Received ${messages.size} messages`))
   *  .catch(console.log);
   */
  getMessages(options = {}) {
    return new Promise((resolve, reject) => {
      this.client.rest.methods.getChannelMessages(this, options)
        .then(data => {
          const messages = new Collection();
          for (const message of data) {
            const msg = new Message(this, message, this.client);
            messages.set(message.id, msg);
            this._cacheMessage(msg);
          }
          resolve(messages);
        })
        .catch(reject);
    });
  }

  _cacheMessage(message) {
    const maxSize = this.client.options.max_message_cache;
    if (maxSize === 0) {
      // saves on performance
      return null;
    }

    if (this.messages.size >= maxSize) {
      this.messages.delete(Array.from(this.messages.keys())[0]);
    }

    this.messages.set(message.id, message);

    return message;
  }
}

function applyProp(structure, prop) {
  structure.prototype[prop] = TextBasedChannel.prototype[prop];
}

exports.applyToClass = (structure, full = false) => {
  const props = ['sendMessage', 'sendTTSMessage'];
  if (full) {
    props.push('_cacheMessage');
    props.push('getMessages');
    props.push('bulkDelete');
  }
  for (const prop of props) {
    applyProp(structure, prop);
  }
};
