import AppNavbar from "../../components/AppNavbar";

const teams = [
  {
    name: "Code Titans",
    event: "Hackathon 2026",
    members: 3,
    needed: "Frontend, Backend",
    description:
      "A student team preparing for a competitive hackathon project.",
  },
  {
    name: "AI Squad",
    event: "AI Workshop",
    members: 2,
    needed: "ML, Presentation",
    description:
      "Focused on building an AI-based concept and presenting it clearly.",
  },
  {
    name: "Pixel Builders",
    event: "Startup Pitch Day",
    members: 4,
    needed: "UI/UX, Flutter",
    description:
      "Collaborating on a startup prototype and pitch-ready demo.",
  },
];

export default function TeamsPage() {
  return (
    <main className="min-h-screen bg-[#f3f5f9]">
      <AppNavbar />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-[#1e3a8a]">Collaboration</p>
              <h1 className="mt-2 text-3xl font-bold text-gray-900">Teams</h1>
              <p className="mt-2 text-sm text-gray-500">
                Join existing teams or create your own for events, projects, and competitions.
              </p>
            </div>

            <button className="rounded-xl bg-[#1e3a8a] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95">
              + Create Team
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <div
              key={team.name}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[#1e3a8a]">{team.name}</h2>
                  <p className="mt-1 text-sm text-gray-500">{team.event}</p>
                </div>

                <div className="rounded-full bg-[#e8eefc] px-3 py-1 text-xs font-semibold text-[#1e3a8a]">
                  {team.members} Members
                </div>
              </div>

              <p className="text-sm leading-6 text-gray-600">{team.description}</p>

              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Needed Skills
                </p>
                <p className="mt-2 text-sm font-medium text-gray-700">{team.needed}</p>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button className="rounded-lg border border-[#1e3a8a] px-4 py-2 text-sm font-medium text-[#1e3a8a] transition hover:bg-[#eef3ff]">
                  View Team
                </button>

                <button className="rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-medium text-white transition hover:opacity-95">
                  Join
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}