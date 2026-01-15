const MissionLog = ({ entries }) => {
  const formatTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <h2 className="text-lg font-semibold mb-3">Einsatztagebuch</h2>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="text-sm text-slate-400">Noch keine Einträge.</div>
        ) : (
          entries
            .slice()
            .reverse()
            .map((entry) => (
              <div
                key={entry.id}
                className="text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg px-3 py-2"
              >
                <div className="text-slate-400">
                  [{formatTime(entry.timestamp)}] {entry.user} - {entry.action}
                </div>
                <div className="text-slate-200">{entry.details}</div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default MissionLog;

