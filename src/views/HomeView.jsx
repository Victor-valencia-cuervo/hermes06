import { AlarmClock, Quote } from 'lucide-react';
import PixelFace from '../components/PixelFace';
import { APP_NAME } from '../lib/format';
import DeviceCard from '../components/DeviceCard';

export default function HomeView({ now, greeting, quote, weather, react, reminders, place, onPoke, onOpenWeather }) {
  const WI = weather?.I;
  const pending = reminders.filter((r) => !r.done).slice(0, 3);
  return (
    <>
      <div className="text-center pt-2 pb-2">
        <h1 className="serif text-5xl sm:text-6xl tracking-[0.3em] uppercase pl-[0.3em]">{APP_NAME}</h1>
        <p className="text-xs mt-3 tracking-[0.25em] uppercase capitalize" style={{ color: 'var(--m)' }}>{now.toLocaleDateString('es-CO', { weekday: 'long' })}</p>
        <p className="text-sm mt-1 tabular-nums" style={{ color: 'var(--a)' }}>{now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
        <p className="serif mt-4 italic text-xl" style={{ color: 'var(--m)' }}>“{greeting}”</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card flex flex-col items-center gap-4">
          <PixelFace face={react.face} kind={react.kind} onClick={onPoke} />
          <p className="text-sm text-center" aria-live="polite">{react.say}</p>
          {weather && (
            <button onClick={onOpenWeather} className="flex items-center gap-2 text-xs hover:opacity-80" style={{ color: 'var(--m)' }} aria-label="Ver detalles del clima">
              <WI size={15} />{weather.temp}{weather.sym || '°C'} · {weather.t} · máx {weather.max}° / mín {weather.min}°{weather.pop >= 30 ? ` · ☂ ${weather.pop}%` : ''} →
            </button>
          )}
        </div>
        <div className="card flex flex-col justify-center">
          <Quote size={20} style={{ color: 'var(--a)' }} className="mb-3" />
          <p className="serif text-2xl leading-snug italic">{quote.t}</p>
          <p className="text-xs tracking-widest uppercase mt-3" style={{ color: 'var(--a)' }}>{quote.a}</p>
        </div>
      </div>
      <DeviceCard />
      <div className="card">
        <p className="text-xs tracking-widest mb-3" style={{ color: 'var(--m)' }}>PRÓXIMOS RECORDATORIOS</p>
        {pending.map((r) => (
          <p key={r.id} className="flex items-center gap-2 text-sm py-1"><AlarmClock size={15} style={{ color: 'var(--a)' }} />{r.text}
            <span className="text-xs" style={{ color: 'var(--m)' }}>{new Date(r.at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span></p>
        ))}
        {!pending.length && <p className="text-sm" style={{ color: 'var(--m)' }}>Nada pendiente.</p>}
      </div>
    </>
  );
}
