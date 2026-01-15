const EventTicker = ({ events, onInjectScenario }) => {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <div className="flex flex-col gap-3 mb-3">
        <h2 className="text-lg font-semibold">Event-Injektions-Panel</h2>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onInjectScenario("deichbruch_fischerdorf")}
            className="px-3 py-2 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600"
          >
            Szenario: Deichbruch Fischerdorf
          </button>
        </div>
      </div>
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {events.map((event) => (
          <div
            key={event.id}
            className="text-sm bg-slate-950 border border-slate-800 rounded-lg px-3 py-2"
          >
            <div className="font-semibold">{event.title}</div>
            <div className="text-slate-400">Status: {event.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventTicker;

