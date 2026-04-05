import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api/client.js';
import { useSocket } from '../context/SocketContext.jsx';

export default function ChatRoomPage() {
  const [params, setParams] = useSearchParams();
  const bookingId = (params.get('booking') || '').trim();
  const [bookingInput, setBookingInput] = useState(bookingId);

  const { socket, connected } = useSocket();
  const [myUserId, setMyUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [joined, setJoined] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    setBookingInput(bookingId);
  }, [bookingId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/auth/me');
        if (!cancelled && data?.user?._id) setMyUserId(data.user._id);
      } catch {
        if (!cancelled) setMyUserId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const appendMessage = useCallback((m) => {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }, []);

  useEffect(() => {
    if (!bookingId) {
      setMessages([]);
      setJoined(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/bookings/${bookingId}/messages`);
        if (!cancelled) setMessages(data.items || []);
      } catch (e) {
        if (!cancelled) {
          toast.error(e.response?.data?.message || 'Không tải được lịch sử chat.');
          setMessages([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  useEffect(() => {
    if (!socket || !connected || !bookingId) {
      setJoined(false);
      return undefined;
    }
    socket.emit('join_room', { bookingId }, (ack) => {
      if (ack?.ok) setJoined(true);
      else {
        setJoined(false);
        toast.error(ack?.message || 'Không tham gia được phòng chat.');
      }
    });
    return undefined;
  }, [socket, connected, bookingId]);

  useEffect(() => {
    if (!socket || !bookingId) return undefined;
    const onChat = (payload) => {
      if (String(payload?.bookingId) !== String(bookingId)) return;
      appendMessage(payload);
    };
    const onStatus = (payload) => {
      if (String(payload?.bookingId) !== String(bookingId)) return;
      toast(`Đơn #${payload.bookingId}: ${payload.status}`, { icon: '📋', duration: 4000 });
    };
    socket.on('chat_message', onChat);
    socket.on('booking_status', onStatus);
    return () => {
      socket.off('chat_message', onChat);
      socket.off('booking_status', onStatus);
    };
  }, [socket, bookingId, appendMessage]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const send = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !socket || !bookingId) return;
    socket.emit('send_message', { bookingId, content: text }, (ack) => {
      if (!ack?.ok) toast.error(ack?.message || 'Gửi thất bại.');
    });
    setDraft('');
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col pb-16 text-slate-200">
      <div className="mb-4 text-center">
        <h1 className="text-lg font-bold text-white">Chat theo booking</h1>
        <p className="text-xs text-slate-500">
          Socket.IO: <code className="text-violet-400">join_room</code>,{' '}
          <code className="text-violet-400">send_message</code>,{' '}
          <code className="text-violet-400">chat_message</code>
        </p>
        <Link to="/wallet-bookings" className="text-xs text-violet-400 underline">
          ← Ví &amp; đặt lịch
        </Link>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded-full px-2 py-0.5 ${connected ? 'bg-emerald-900/60 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}
        >
          {connected ? 'Socket đã kết nối' : 'Socket chưa kết nối'}
        </span>
        {bookingId && (
          <span className={joined ? 'text-emerald-400' : 'text-amber-400'}>
            {joined ? 'Đã join room' : 'Đang join room…'}
          </span>
        )}
      </div>

      <label className="mb-2 block text-sm text-slate-400">
        Mã booking
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-sm text-white"
            placeholder="Dán _id đơn"
            value={bookingInput}
            onChange={(e) => setBookingInput(e.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              const v = bookingInput.trim();
              if (v) setParams({ booking: v });
              else setParams({});
            }}
            className="shrink-0 rounded-lg bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600"
          >
            Áp dụng
          </button>
        </div>
      </label>
      <p className="mb-3 text-xs text-slate-500">
        Hoặc mở link từ danh sách đơn (ví &amp; đặt lịch).
      </p>

      <div
        ref={listRef}
        className="mb-3 flex max-h-[420px] min-h-[200px] flex-col gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/50 p-3"
      >
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-600">Chưa có tin nhắn.</p>
        )}
        {messages.map((m) => {
          const mine = myUserId && String(m.senderId) === String(myUserId);
          return (
            <div
              key={m.id}
              className={`flex w-full ${mine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-md ${
                  mine
                    ? 'rounded-br-md bg-violet-600 text-white'
                    : 'rounded-bl-md border border-slate-600 bg-slate-800 text-slate-100'
                }`}
              >
                {!mine && (
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
                    {m.senderUsername || m.senderId}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className={`mt-1 text-[10px] ${mine ? 'text-violet-200' : 'text-slate-500'}`}>
                  {m.createdAt
                    ? new Date(m.createdAt).toLocaleString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      })
                    : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nhập tin nhắn…"
          disabled={!connected || !joined}
          className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-600 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!connected || !joined || !draft.trim()}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Gửi
        </button>
      </form>
    </div>
  );
}
