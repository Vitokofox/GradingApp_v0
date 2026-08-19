import React from 'react';
import { CircleHelp, MessageCircle, SendHorizontal } from 'lucide-react';
import { useQualityAssistant } from '../context/QualityAssistantContext';

const IANormasEstudios = () => {
    const { openAssistant, sendQuestion, suggestions, loading, messages } = useQualityAssistant();

    return (
        <div className="ga-stack" style={{ gap: '1rem' }}>
            <div className="ga-card">
                <div className="ga-card__header">
                    <h1 className="ga-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CircleHelp size={20} /> IA Normas y Estudios
                    </h1>
                </div>

                <div className="ga-card__body ga-stack" style={{ gap: '1rem' }}>
                    <p className="u-muted" style={{ margin: 0 }}>
                        El asistente ahora está disponible como widget flotante desde cualquier pantalla de GradingApp. La conversación se mantiene mientras navegas por la aplicación.
                    </p>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className="ga-btn ga-btn--primary"
                            onClick={() => openAssistant()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <MessageCircle size={16} /> Abrir asistente flotante
                        </button>
                    </div>

                    <div className="ga-stack" style={{ gap: '0.6rem' }}>
                        <strong>Sugerencias rápidas</strong>
                        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                            {suggestions.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    className="ga-btn ga-btn--outline"
                                    disabled={loading}
                                    onClick={() => sendQuestion(suggestion, 3)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                                >
                                    <SendHorizontal size={14} /> {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span className="ga-badge ga-badge--muted">Conversación actual: {messages.length} mensaje(s)</span>
                        <span className="ga-badge ga-badge--ok">Backend local /consultar</span>
                        <span className="ga-badge ga-badge--muted">Sin APIs externas</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IANormasEstudios;
