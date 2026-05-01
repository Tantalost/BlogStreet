import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#f8f9fb] font-['Inter',system-ui,sans-serif] text-slate-900"
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.07) 1px, transparent 0)',
        backgroundSize: '14px 14px',
      }}
    >
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1320px] flex-col px-4 pb-4 pt-4 sm:px-7 sm:pb-6 lg:px-12">
        <header className="landing-fade-up flex items-center justify-between gap-4 rounded-full border border-slate-200/80 bg-white/85 px-4 py-2 shadow-[0_14px_30px_rgba(15,23,42,0.08)] backdrop-blur md:px-6">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-md border border-slate-200 bg-white p-[2px] shadow-sm">
              <img src="/brand-logo.png" alt="BlogStreet logo" className="h-full w-full rounded-[5px] object-cover" />
            </div>
            <span className="text-xl font-semibold tracking-tight">BlogStreet</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Link to="/sign-in" className="inline-flex text-sm font-medium text-slate-700 transition hover:text-slate-950">
              Sign in
            </Link>
            <Link
              to="/sign-up"
              className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              Start taking notes
            </Link>
          </div>
        </header>

        <section className="landing-fade-up relative mt-3 flex min-h-[calc(100vh-145px)] items-center justify-center rounded-[34px] border border-white/80 bg-white/40 px-4 py-8 shadow-[0_30px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:px-8 sm:py-10 lg:min-h-[calc(100vh-165px)] lg:px-16 lg:py-11 xl:min-h-[calc(100vh-145px)] xl:px-20 xl:py-12">
          <div className="relative z-20 mx-auto max-w-2xl text-center" style={{ animationDelay: '120ms' }}>
            <div className="mb-5 flex justify-center">
            </div>
            <h1 className="landing-fade-up text-balance text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-[3.35rem] xl:text-6xl" style={{ animationDelay: '220ms' }}>
              Capture, organize, and reflect
              <span className="mt-1 block font-medium text-slate-400">all in one place</span>
            </h1>
            <p
              className="landing-fade-up mx-auto mt-3.5 max-w-xl text-pretty text-center text-base text-slate-600 lg:mt-4 lg:text-[1.05rem] sm:text-lg"
              style={{ animationDelay: '300ms' }}
            >
              Effortlessly manage your personalized notes and boost productivity.
            </p>
            <Link
              to="/sign-up"
              className="landing-fade-up landing-button-glow mt-6 inline-flex rounded-2xl bg-blue-600 px-7 py-3.5 text-base font-semibold !text-white shadow-[0_18px_30px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 hover:bg-blue-500 lg:mt-7"
              style={{ animationDelay: '360ms' }}
            >
              Start taking notes
            </Link>
          </div>

          <div className="landing-float-medium pointer-events-none absolute left-4 top-8 hidden -rotate-3 xl:block xl:left-10 motion-reduce:animate-none">
            <div className="relative">
              <div className="w-40 rounded-sm border border-white/75 bg-yellow-200/68 p-3.5 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-[3px] lg:w-44 lg:p-4">
                <p className="font-['Comic_Neue',cursive] text-lg font-bold leading-tight text-slate-900">
                  Take notes to keep track of details and move tasks faster.
                </p>
              </div>
              <div className="absolute -bottom-7 -right-6 grid h-20 w-20 place-items-center rounded-2xl border border-white/85 bg-white/58 shadow-[0_16px_36px_rgba(15,23,42,0.14)] backdrop-blur-lg lg:-bottom-8 lg:-right-7 lg:h-24 lg:w-24">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-500 text-2xl text-white">✓</div>
              </div>
            </div>
          </div>

          <div className="landing-float-slow pointer-events-none absolute bottom-3 left-4 hidden w-56 -rotate-1 rounded-3xl border border-white/75 bg-white/50 p-4 shadow-[0_20px_42px_rgba(15,23,42,0.12)] backdrop-blur-2xl md:block lg:left-10 lg:w-64 xl:bottom-5 xl:w-72 motion-reduce:animate-none">
            <p className="text-lg font-semibold text-slate-800">Recent Notes</p>
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Weekly planning draft</span>
                  <span>65%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-200/60">
                  <div className="h-full w-[65%] rounded-full bg-sky-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Reflection journal</span>
                  <span>Apr 27</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-200/60">
                  <div className="h-full w-[34%] rounded-full bg-blue-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="landing-float-medium pointer-events-none absolute right-4 top-8 hidden rotate-3 xl:block xl:right-10 motion-reduce:animate-none">
            <div className="relative w-44 rounded-3xl border border-white/75 bg-white/50 px-4 py-3.5 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-2xl lg:w-48 lg:px-5 lg:py-4">
              <p className="text-lg font-semibold text-slate-800">Reminders</p>
              <p className="mt-2 text-xs text-slate-500">Today&apos;s meeting with your writing buddy.</p>
              <div className="mt-3 rounded-xl border border-blue-100/80 bg-blue-50/70 px-3 py-2 text-sm text-blue-700">13:00 - 13:45</div>
              <div className="absolute -left-8 top-6 grid h-14 w-14 place-items-center rounded-2xl border border-white/85 bg-white/58 text-2xl shadow-[0_16px_36px_rgba(15,23,42,0.13)] backdrop-blur-lg lg:-left-9 lg:h-16 lg:w-16 lg:text-3xl">
                ⏰
              </div>
            </div>
          </div>

          <div className="landing-float-slow pointer-events-none absolute bottom-3 right-4 hidden w-56 rotate-2 rounded-3xl border border-white/75 bg-white/50 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-2xl md:block lg:right-10 lg:w-64 xl:bottom-5 xl:w-72 motion-reduce:animate-none">
            <p className="text-lg font-semibold text-slate-800">100+ Integrations</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/85 bg-white/60 shadow-[0_10px_22px_rgba(15,23,42,0.11)] backdrop-blur-md">📧</div>
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/85 bg-white/60 shadow-[0_10px_22px_rgba(15,23,42,0.11)] backdrop-blur-md">💬</div>
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/85 bg-white/60 shadow-[0_10px_22px_rgba(15,23,42,0.11)] backdrop-blur-md">📅</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
