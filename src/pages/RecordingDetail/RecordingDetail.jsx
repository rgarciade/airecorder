import React, { useState } from 'react';

const mockTopics = [
  { name: 'Introduction', timestamp: '0:00', timestampSeconds: 0 },
  { name: 'Marketing Strategy', timestamp: '5:20', timestampSeconds: 320 },
  { name: 'Budget Discussion', timestamp: '12:45', timestampSeconds: 765 },
  { name: 'Launch Date', timestamp: '20:10', timestampSeconds: 1210 },
  { name: 'Action Items', timestamp: '28:30', timestampSeconds: 1710 },
];

const mockInitialParticipants = [
  { id: 1, name: 'Ana García', role: 'Organizadora' },
  { id: 2, name: 'Carlos Mendoza', role: 'Participante' },
  { id: 3, name: 'María López', role: 'Participante' },
];

const mockMessages = [
  {
    id: 1,
    speaker: 'Speaker 1',
    message: 'What was the final budget approved for the marketing campaign?',
  },
  {
    id: 2,
    speaker: 'Speaker 2',
    message: 'The final budget approved for the marketing campaign was $50,000.',
  },
  {
    id: 3,
    speaker: 'Speaker 1',
    message: 'When is the tentative launch date?',
  },
  {
    id: 4,
    speaker: 'Speaker 2',
    message: 'The tentative launch date is set for July 15th.',
  },
];

export default function RecordingDetail({ onBack }) {
  const [question, setQuestion] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimestamp, setCurrentTimestamp] = useState(null);
  const [participants, setParticipants] = useState(mockInitialParticipants);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [showParticipantForm, setShowParticipantForm] = useState(false);

  const handlePlayFromTimestamp = (timestampSeconds) => {
    setIsPlaying(true);
    setCurrentTimestamp(timestampSeconds);
    // Aquí irá la lógica real de reproducción
    console.log(`Playing from ${timestampSeconds} seconds`);
  };

  const handleAddParticipant = () => {
    if (newParticipantName.trim()) {
      const newParticipant = {
        id: Date.now(),
        name: newParticipantName.trim(),
        role: 'Participante'
      };
      setParticipants([...participants, newParticipant]);
      setNewParticipantName('');
      setShowParticipantForm(false);
    }
  };

  const handleRemoveParticipant = (participantId) => {
    setParticipants(participants.filter(p => p.id !== participantId));
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-[#221112]"
      style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans", sans-serif' }}
    >
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#472426] px-10 py-3">
        <div className="flex items-center gap-4 text-white">
          <div className="size-4">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z"
                fill="currentColor"
              ></path>
            </svg>
          </div>
          <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">Meeting Recorder</h2>
        </div>
        <div className="flex items-center gap-8">
          <button
            onClick={onBack}
            className="flex cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 bg-[#472426] text-white gap-2 text-sm font-bold leading-normal tracking-[0.015em] px-2.5"
          >
            <div className="text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" fill="currentColor" viewBox="0 0 256 256">
                <path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"></path>
              </svg>
            </div>
          </button>
          <div
            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10"
            style={{
              backgroundImage:
                'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAogyadNUeGL36ivwWfecIbkXtQgBfVQeOlMBPDuo96aaTlM9NBlwpxPPZO8BPgTUK4kU85TvtZesaONhHFtVUv55Put8hqzQgkVFr2GKxPe0Z5_QkH8TSa1aRiTPzYV3PzZ16GuRU0TN3_rt4NooSThdUdWpvMYvFrRgtxoXnIQbQCxqXmVggpEtpXRPCeL0hrP1O8v3JD0eeSEOefzzO8SPQxS_EQ9f_7ecMTpM9T6eL0B5KM9R0OqyJNcKlaK6C8V4qnp3E")',
            }}
          ></div>
        </div>
      </header>
      <div className="gap-1 px-6 flex flex-1 justify-center py-5">
        <div className="layout-content-container flex flex-col w-80">
          <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Meeting Summary</h2>
          <p className="text-white text-base font-normal leading-normal pb-3 pt-1 px-4">
            This meeting discussed the upcoming product launch, focusing on marketing strategies and timelines. Key decisions included finalizing the campaign budget and
            selecting the launch date.
          </p>
          <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Key Topics</h2>
          {mockTopics.map((topic, index) => (
            <div key={index} className="flex items-center gap-4 bg-[#221112] px-4 min-h-14 justify-between group hover:bg-[#331a1b] transition-colors">
              <p className="text-white text-base font-normal leading-normal flex-1 truncate">{topic.name}</p>
              <div className="shrink-0 flex items-center gap-3">
                <p className="text-[#c89295] text-sm font-normal leading-normal">{topic.timestamp}</p>
                <button
                  onClick={() => handlePlayFromTimestamp(topic.timestampSeconds)}
                  className={`text-white opacity-0 group-hover:opacity-100 transition-opacity ${isPlaying && currentTimestamp === topic.timestampSeconds ? 'text-[#e92932]' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"></path>
                  </svg>
                </button>
              </div>
            </div>
          ))}
          
          <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Participantes</h2>
          <div className="px-4 pb-4">
            {participants.map((participant) => (
              <div key={participant.id} className="flex items-center justify-between bg-[#221112] px-4 py-3 mb-2 rounded-lg hover:bg-[#331a1b] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#e92932] rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">
                      {participant.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{participant.name}</p>
                    <p className="text-[#c89295] text-xs">{participant.role}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveParticipant(participant.id)}
                  className="text-[#c89295] hover:text-[#e92932] transition-colors p-1"
                  title="Eliminar participante"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>
                  </svg>
                </button>
              </div>
            ))}
            
            {showParticipantForm ? (
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="text"
                  value={newParticipantName}
                  onChange={(e) => setNewParticipantName(e.target.value)}
                  placeholder="Nombre del participante"
                  className="flex-1 px-3 py-2 text-white bg-[#331a1b] border border-[#472426] rounded-lg focus:outline-none focus:border-[#663336]"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddParticipant()}
                />
                <button
                  onClick={handleAddParticipant}
                  className="px-3 py-2 bg-[#e92932] text-white rounded-lg hover:bg-[#d41f27] transition-colors"
                >
                  ✓
                </button>
                <button
                  onClick={() => {
                    setShowParticipantForm(false);
                    setNewParticipantName('');
                  }}
                  className="px-3 py-2 bg-[#472426] text-white rounded-lg hover:bg-[#663336] transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowParticipantForm(true)}
                className="flex items-center gap-2 w-full px-4 py-3 mt-2 bg-[#331a1b] text-[#c89295] rounded-lg hover:bg-[#472426] hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"></path>
                </svg>
                <span className="text-sm">Agregar participante</span>
              </button>
            )}
          </div>
        </div>
        <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
          <div className="flex flex-wrap justify-between gap-3 p-4">
            <p className="text-white tracking-light text-[32px] font-bold leading-tight min-w-72">Product Launch Meeting</p>
          </div>
          <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
            <label className="flex flex-col min-w-40 flex-1">
              <input
                placeholder="Ask a question about the meeting"
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-white focus:outline-0 focus:ring-0 border border-[#663336] bg-[#331a1b] focus:border-[#663336] h-14 placeholder:text-[#c89295] p-[15px] text-base font-normal leading-normal"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </label>
          </div>
          {mockMessages.map((msg, index) => {
            const isNewSpeaker = index === 0 || mockMessages[index - 1].speaker !== msg.speaker;
            return (
              <div key={msg.id} className={`flex items-end gap-3 p-4 ${msg.speaker === 'Speaker 2' ? 'justify-end' : ''}`}>
                <div className={`flex flex-1 flex-col gap-1 ${msg.speaker === 'Speaker 2' ? 'items-end' : 'items-start'}`}>
                  {isNewSpeaker && (
                    <p className="text-[#c89295] text-[13px] font-normal leading-normal max-w-[360px]">{msg.speaker}</p>
                  )}
                  <p
                    className={`text-base font-normal leading-normal flex max-w-[360px] rounded-xl px-4 py-3 ${
                      msg.speaker === 'Speaker 2' ? 'bg-[#e92932]' : 'bg-[#472426]'
                    } text-white`}
                  >
                    {msg.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 