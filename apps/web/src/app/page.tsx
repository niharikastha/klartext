import Link from 'next/link'
import { FileText, Zap, Bell, ArrowRight, Shield, Sparkles } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-brand-glow">
              <Sparkles size={15} className="text-white" />
            </div>
            <span className="text-[15px] font-bold text-slate-900 tracking-tight">klartext</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 font-medium px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors">
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2 rounded-xl transition-all shadow-brand-glow hover:shadow-lg"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-8 border border-brand-200 tracking-wide uppercase">
          <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
          Built for immigrants in Germany
        </div>

        <h1 className="text-[52px] font-bold text-slate-900 leading-[1.1] tracking-tight mb-6">
          Understand any German
          <br />
          <span className="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent">
            official document
          </span>{' '}
          instantly
        </h1>

        <p className="text-lg text-slate-500 mb-10 max-w-xl mx-auto leading-relaxed">
          Upload your lease, visa letter, tax notice, or registration form.
          Our AI reads it, translates it, and tells you exactly what to do next.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-3.5 rounded-2xl transition-all text-[15px] shadow-brand-glow hover:shadow-lg hover:-translate-y-0.5"
          >
            Upload a document
            <ArrowRight size={17} />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium px-5 py-3.5 text-[15px] rounded-2xl hover:bg-slate-50 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              icon: FileText,
              gradient: 'from-brand-500 to-brand-600',
              bg: 'bg-brand-50',
              title: 'Upload any document',
              desc: 'PDF, photo, scan — our AI handles it all. Rental contracts, visa letters, tax notices, health insurance forms.',
            },
            {
              icon: Zap,
              gradient: 'from-violet-500 to-purple-600',
              bg: 'bg-violet-50',
              title: 'AI extracts action items',
              desc: 'Every deadline, payment, appointment, and required document is pulled out and listed clearly in English.',
            },
            {
              icon: Bell,
              gradient: 'from-amber-500 to-orange-500',
              bg: 'bg-amber-50',
              title: 'Never miss a deadline',
              desc: 'All your action items in one dashboard, sorted by urgency. Know exactly what needs to happen and when.',
            },
          ].map(({ icon: Icon, gradient, bg, title, desc }) => (
            <div key={title} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-shadow group">
              <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-4`}>
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                  <Icon size={15} className="text-white" />
                </div>
              </div>
              <h3 className="font-semibold text-slate-900 text-[15px] mb-2">{title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer bar */}
      <section className="border-t border-slate-100 py-8">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-center gap-8 text-sm text-slate-400 flex-wrap">
          <span className="flex items-center gap-2"><Shield size={14} /> Private &amp; secure</span>
          <span className="flex items-center gap-2"><Sparkles size={14} /> 4-agent AI pipeline</span>
          <span className="flex items-center gap-2"><Zap size={14} /> GPT-4o powered</span>
        </div>
      </section>
    </div>
  )
}
