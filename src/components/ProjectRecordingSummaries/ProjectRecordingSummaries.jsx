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
                    className="bg-white border border-gray-200 rounded-lg overflow-hidden transition-all hover:border-blue-200 shadow-sm"
                >
                    {/* Header - Siempre visible */}
                    <div
                        className="flex items-center justify-between p-4 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                        onClick={() => toggleExpand(rec.id)}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="flex flex-col overflow-hidden">
                                <h4 className="text-gray-900 font-medium truncate text-sm">
                                    {rec.title || `Grabación ${rec.id}`}
                                </h4>
                                <span className="text-gray-500 text-xs">
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
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                                title="Ver grabación completa"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256">
                                    <path d="M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z"></path>
                                </svg>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpand(rec.id);
                                }}
                                className={`p-1.5 rounded transition-all ${expandedId === rec.id ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                title={expandedId === rec.id ? "Cerrar resumen" : "Ver resumen"}
                            >
                                <svg 
                                    className={`w-5 h-5 transition-transform duration-200 ${expandedId === rec.id ? 'rotate-180' : ''}`}
                                    fill="none" 
                                    viewBox="0 0 24 24" 
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Content - Expandible */}
                    {expandedId === rec.id && (
                        <div className="p-4 border-t border-gray-200 bg-white">
                            <div className="mb-3">
                                <h5 className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">Resumen</h5>
                                <p className="text-gray-700 text-sm leading-relaxed">
                                    {rec.summary?.resumen_breve || 'Sin resumen disponible.'}
                                </p>
                            </div>

                            {rec.summary?.ideas && rec.summary.ideas.length > 0 && (
                                <div className="mb-4">
                                    <h5 className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">Puntos Clave</h5>
                                    <ul className="list-disc list-inside space-y-1.5">
                                        {rec.summary.ideas.map((idea, idx) => (
                                            <li key={idx} className="text-gray-600 text-sm leading-relaxed">
                                                {idea}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex justify-end">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onNavigateToRecording(rec.id);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md text-xs font-semibold transition-colors border border-blue-100"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256">
                                        <path d="M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z"></path>
                                    </svg>
                                    Ver grabación completa
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
