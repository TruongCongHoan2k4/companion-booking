/**
 * Realtime qua Socket.IO — khớp backend (path /socket.io, JWT handshake).
 * Giữ tên API RealtimeStomp để không đổi companion.js / user.js.
 */
(function (global) {
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Không tải được: ' + src));
      document.head.appendChild(s);
    });
  }

  const RealtimeStomp = {
    socket: null,
    connected: false,
    _connectPromise: null,

    ensureLibs() {
      if (global.io) {
        return Promise.resolve();
      }
      return loadScript('https://cdn.socket.io/4.8.1/socket.io.min.js');
    },

    connect() {
      if (this.socket?.connected) {
        this.connected = true;
        return Promise.resolve(this.socket);
      }
      if (this._connectPromise) {
        return this._connectPromise;
      }

      this._connectPromise = this.ensureLibs().then(
        () =>
          new Promise((resolve, reject) => {
            const token = global.localStorage?.getItem('token');
            const socket = global.io(global.location.origin, {
              path: '/socket.io',
              transports: ['websocket', 'polling'],
              withCredentials: true,
              auth: token ? { token } : {},
            });

            socket.on('connect', () => {
              this.socket = socket;
              this.connected = true;
              if (this._connectPromise) {
                this._connectPromise = null;
                resolve(socket);
              }
            });

            socket.on('disconnect', () => {
              this.connected = false;
            });

            socket.once('connect_error', (err) => {
              this._connectPromise = null;
              try {
                socket.disconnect();
              } catch (_) {}
              this.socket = null;
              this.connected = false;
              reject(err || new Error('Socket.IO connect failed'));
            });
          })
      );

      return this._connectPromise;
    },

    /**
     * userId chỉ để tương thích gọi cũ; server đã join room theo JWT.
     * @returns {Promise<{ unsubscribe: function }>}
     */
    subscribeNotifications(_userId, onMessage) {
      return this.connect().then(() => {
        const handler = (payload) => {
          try {
            onMessage(payload);
          } catch (e) {
            console.warn('notification handler', e);
          }
        };
        this.socket.on('notification', handler);
        return {
          unsubscribe: () => {
            this.socket?.off('notification', handler);
          },
        };
      });
    },

    /**
     * @returns {Promise<{ unsubscribe: function }>}
     */
    subscribeChat(bookingId, onMessage) {
      const bid = String(bookingId);
      return this.connect().then(
        () =>
          new Promise((resolve, reject) => {
            this.socket.emit('join_room', { bookingId: bid }, (ack) => {
              if (!ack || !ack.ok) {
                reject(new Error(ack?.message || 'join_room thất bại'));
                return;
              }
              const handler = (payload) => {
                if (String(payload?.bookingId) !== bid) return;
                try {
                  onMessage(payload);
                } catch (e) {
                  console.warn('chat_message handler', e);
                }
              };
              this.socket.on('chat_message', handler);
              resolve({
                unsubscribe: () => {
                  this.socket?.off('chat_message', handler);
                },
              });
            });
          })
      );
    },
  };

  global.RealtimeStomp = RealtimeStomp;
})(window);
