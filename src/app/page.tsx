import { ChatWidget } from "@/components/ChatWidget";
import { OpenChatButton } from "@/components/OpenChatButton";
import { clinic } from "@/lib/clinic";

const services = [
  { name: "Check-ups & cleaning", price: "New patients $199", desc: "Exam, digital X-rays and a gentle cleaning in one visit.", icon: "✨" },
  { name: "Teeth whitening", price: "From $299", desc: "In-office whitening in 90 minutes or a custom take-home kit.", icon: "😁" },
  { name: "Invisalign", price: "Free consultation", desc: "Straighten your teeth with clear aligners and a free 3D scan.", icon: "🦷" },
  { name: "Dental implants", price: "From $3,900", desc: "Permanent, natural-looking replacement for missing teeth.", icon: "🔩" },
  { name: "Children's dentistry", price: "Kids' check-up $99", desc: "Fun, gentle visits for children from age 3.", icon: "🧸" },
  { name: "Same-day emergencies", price: "Emergency exam $129", desc: "Toothache, broken tooth or lost filling? We keep time free daily.", icon: "🚑" },
];

const insurers = ["Delta Dental", "Cigna", "MetLife", "Aetna", "Guardian", "United Concordia"];

const team = [
  { name: "Dr. Sarah Mitchell, DDS", role: "Lead dentist · Implants & cosmetic", initials: "SM" },
  { name: "Dr. James Ortega, DMD", role: "Family & children's dentistry · Habla español", initials: "JO" },
  { name: "Dr. Priya Nair, DDS", role: "Root canals & restorative", initials: "PN" },
];

export default function Home() {
  return (
    <div className="min-h-full bg-white">
      <div className="bg-slate-900 px-4 py-2 text-center text-xs text-slate-200">
        Demo website: Brightsmile Dental is a fictional clinic created to showcase an AI chatbot.
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="#" className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-white">B</span>
            {clinic.name}
          </a>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            <a href="#services" className="hover:text-slate-900">Services</a>
            <a href="#insurance" className="hover:text-slate-900">Insurance</a>
            <a href="#team" className="hover:text-slate-900">Our team</a>
            <a href="#visit" className="hover:text-slate-900">Visit us</a>
          </nav>
          <a
            href={clinic.phoneHref}
            className="rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <span className="hidden sm:inline">Call </span>{clinic.phone}
          </a>
        </div>
      </header>

      <main>
        <section className="bg-gradient-to-b from-teal-50 to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
            <div>
              <p className="mb-4 inline-flex rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">
                Now welcoming new patients in {clinic.city}
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                {clinic.tagline}
              </h1>
              <p className="mt-5 text-lg text-slate-600">
                From check-ups to Invisalign and implants, our team makes every visit calm and
                comfortable. Got a question at 11 PM? Our assistant {clinic.assistantName} answers
                instantly, day or night.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <OpenChatButton className="rounded-full bg-teal-700 px-6 py-3 font-semibold text-white shadow-lg shadow-teal-900/20 hover:bg-teal-800">
                  Chat with {clinic.assistantName}
                </OpenChatButton>
                <a
                  href={clinic.phoneHref}
                  className="rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-800 hover:border-slate-400"
                >
                  Call {clinic.phone}
                </a>
              </div>
              <dl className="mt-10 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-slate-500">Serving Austin</dt>
                  <dd className="text-xl font-bold text-slate-900">Since 2011</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Open</dt>
                  <dd className="text-xl font-bold text-slate-900">Saturdays</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Emergencies</dt>
                  <dd className="text-xl font-bold text-slate-900">Same day</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">Patients often ask {clinic.assistantName}…</p>
              <ul className="mt-4 space-y-3 text-sm">
                {[
                  ["Do you take Delta Dental?", "Yes, we're in-network with Delta Dental PPO."],
                  ["How much is whitening?", "In-office whitening is $499, take-home kits are $299."],
                  ["I knocked out a tooth!", "Keep it in milk and call us right now: time matters."],
                ].map(([q, a]) => (
                  <li key={q} className="space-y-2">
                    <p className="ml-auto w-fit rounded-2xl rounded-br-sm bg-teal-700 px-3.5 py-2 text-white">{q}</p>
                    <p className="w-fit rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2 text-slate-800">{a}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="services" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Treatments</h2>
          <p className="mt-2 text-slate-600">Transparent pricing. Your dentist confirms the exact cost after an exam.</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div key={s.name} className="rounded-2xl border border-slate-200 p-6 transition hover:shadow-md">
                <div className="text-3xl" aria-hidden>{s.icon}</div>
                <h3 className="mt-4 font-semibold text-slate-900">{s.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
                <p className="mt-4 text-sm font-semibold text-teal-700">{s.price}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="insurance" className="bg-slate-50">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">Insurance & payment</h2>
              <p className="mt-3 text-slate-600">
                We&apos;re in-network with most major PPO plans and file claims for you. 0% financing
                through CareCredit and Sunbit for treatment over $1,000.
              </p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {insurers.map((i) => (
                  <li key={i} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
                    {i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-teal-700 p-8 text-white">
              <p className="text-sm font-semibold text-teal-100">No insurance?</p>
              <h3 className="mt-1 text-2xl font-bold">Brightsmile Membership</h3>
              <p className="mt-2 text-4xl font-bold">
                $29<span className="text-base font-medium text-teal-100">/month</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm text-teal-50">
                <li>✓ 2 check-ups & cleanings per year</li>
                <li>✓ All routine X-rays</li>
                <li>✓ 1 emergency exam per year</li>
                <li>✓ 15% off all other treatments</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="team" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Meet your dentists</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {team.map((d) => (
              <div key={d.name} className="rounded-2xl border border-slate-200 p-6">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-teal-100 font-bold text-teal-800">
                  {d.initials}
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{d.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{d.role}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="visit" className="bg-slate-50">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">Visit us</h2>
              <p className="mt-3 text-slate-600">{clinic.address}</p>
              <p className="mt-1 text-slate-600">Free parking · wheelchair accessible</p>
              <p className="mt-4">
                <a href={clinic.phoneHref} className="font-semibold text-teal-700 hover:underline">{clinic.phone}</a>
              </p>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {clinic.hours.map((h) => (
                  <tr key={h.days} className="border-b border-slate-200">
                    <td className="py-3 font-medium text-slate-900">{h.days}</td>
                    <td className="py-3 text-right text-slate-600">{h.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500 sm:px-6">
          © {new Date().getFullYear()} {clinic.name} (fictional demo). In a life-threatening emergency, call 911.
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}
