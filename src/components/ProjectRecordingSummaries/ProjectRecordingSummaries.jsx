import React, { useState } from 'react';

export default function ProjectRecordingSummaries({ recordings, onNavigateToRecording }) {
    const [expandedId, setExpandedId] = useState(null);

    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    if (!recordings || recordings.length === 0) {
        return (
            <div className="text-gray-400 text-sm italic p-4">
                No hay grabaciones analizadas disponibles.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {recordings.map((rec) => (
                <div
                    key={rec.id}
                    className="bg-[#2a1a1b] border border-[#472426] rounded-lg overflow-hidden transition-all hover:border-[#663336]"
                >
                    {/* Header - Siempre visible */}
                    <div
                        className="flex items-center justify-between p-4 cursor-pointer bg-[#331a1b] hover:bg-[#3f2022]"
                        onClick={() => toggleExpand(rec.id)}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="bg-[#e92932] w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                                <span className="text-white text-xs font-bold">
                                    {new Date(rec.date || Date.now()).getDate()}
                                </span>
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <h4 className="text-white font-medium truncate text-sm">
                                    {rec.title || `Grabación ${rec.id}`}
                                </h4>
                                <span className="text-[#c89295] text-xs">
                                    {rec.date ? new Date(rec.date).toLocaleDateString() : 'Fecha desconocida'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigateToRecording(rec.id);
                                }}
                                className="p-1.5 text-[#c89295] hover:text-white hover:bg-[#472426] rounded transition-colors"
                                title="Ir a la grabación"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                                    <path d="M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z"></path>
                                </svg>
                            </button>
                            <svg
                                className={`w-5 h-5 text-[#c89295] transition-transform duration-200 ${expandedId === rec.id ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>

                    {/* Content - Expandible */}
                    {expandedId === rec.id && (
                        <div className="p-4 border-t border-[#472426] bg-[#221112]">
                            <div className="mb-3">
                                <h5 className="text-[#e92932] text-xs font-bold uppercase tracking-wider mb-1">Resumen</h5>
                                <p className="text-gray-300 text-sm leading-relaxed">
                                    {rec.summary?.resumen_breve || 'Sin resumen disponible.'}
                                </p>
                            </div>

                            {rec.summary?.ideas && rec.summary.ideas.length > 0 && (
                                <div>
                                    <h5 className="text-[#e92932] text-xs font-bold uppercase tracking-wider mb-1">Puntos Clave</h5>
                                    <ul className="list-disc list-inside space-y-1">
                                        {rec.summary.ideas.slice(0, 3).map((idea, idx) => (
                                            <li key={idx} className="text-gray-400 text-sm truncate">
                                                {idea}
                                            </li>
                                        ))}
                                        {rec.summary.ideas.length > 3 && (
                                            <li className="text-[#c89295] text-xs italic pt-1">
                                                +{rec.summary.ideas.length - 3} puntos más...
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
