/**
 * STOMP over SockJS — /ws: notifications.user.{id}, chat.booking.{id}
 */
(function (global) {
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error("Không tải được: " + src));
            document.head.appendChild(s);
        });
    }

    const RealtimeStomp = {
        client: null,
        connected: false,
        _connectPromise: null,

        ensureLibs() {
            if (global.SockJS && global.Stomp) {
                return Promise.resolve();
            }
            return loadScript("https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js").then(() =>
                loadScript("https://cdn.jsdelivr.net/npm/stompjs@2.3.3/lib/stomp.min.js")
            );
        },

        connect() {
            if (this.connected && this.client) {
                return Promise.resolve(this.client);
            }
            if (this._connectPromise) {
                return this._connectPromise;
            }
            this._connectPromise = this.ensureLibs().then(
                () =>
                    new Promise((resolve, reject) => {
                        const socket = new global.SockJS("/ws");
                        const client = global.Stomp.over(socket);
                        client.debug = null;
                        client.connect(
                            {},
                            () => {
                                this.client = client;
                                this.connected = true;
                                this._connectPromise = null;
                                resolve(client);
                            },
                            (err) => {
                                this._connectPromise = null;
                                reject(err || new Error("STOMP connect failed"));
                            }
                        );
                    })
            );
            return this._connectPromise;
        },

        /**
         * @returns {Promise<object>} subscription (có .unsubscribe)
         */
        subscribeNotifications(userId, onMessage) {
            return this.connect().then(() => {
                return this.client.subscribe(`/topic/notifications.user.${userId}`, (message) => {
                    try {
                        onMessage(JSON.parse(message.body));
                    } catch (e) {
                        console.warn("notification parse", e);
                    }
                });
            });
        },

        /**
         * @returns {Promise<object>} subscription
         */
        subscribeChat(bookingId, onMessage) {
            return this.connect().then(() => {
                return this.client.subscribe(`/topic/chat.booking.${bookingId}`, () => {
                    onMessage();
                });
            });
        }
    };

    global.RealtimeStomp = RealtimeStomp;
})(window);
