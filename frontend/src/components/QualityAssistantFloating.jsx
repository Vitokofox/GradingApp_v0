import React, { useEffect, useRef } from 'react';
import { CircleHelp, Eraser, Loader2, MessageCircle, Minimize2, SendHorizontal, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { QUALITY_ASSISTANT_QUICK_GROUPS, useQualityAssistant } from '../context/QualityAssistantContext';
import './QualityAssistantFloating.css';

const formatScore = (score) => {
    if (typeof score !== 'number' || Number.isNaN(score)) {
        return null;
    }
    return score.toFixed(2);
};

const QualityAssistantFloating = () => {
    const location = useLocation();
    const {
        isOpen,
        draft,
        messages,
        loading,
        setDraft,
        toggleAssistant,
        closeAssistant,
        clearConversation,
        sendQuestion,
        suggestions,
        openAssistant,
    } = useQualityAssistant();

    const endRef = useRef(null);
    const textareaRef = useRef(null);

    const hiddenRoutes = ['/login', '/register'];
    const isHiddenRoute = hiddenRoutes.includes(location.pathname);

    useEffect(() => {
        if (!isOpen || isHiddenRoute) {
            return;
        }
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [isOpen, isHiddenRoute, loading, messages]);

    useEffect(() => {
        if (!isOpen || isHiddenRoute) {
            return;
        }
        textareaRef.current?.focus();
    }, [isOpen, isHiddenRoute]);

    if (isHiddenRoute) {
        return null;
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        await sendQuestion(draft, 3);
        requestAnimationFrame(() => textareaRef.current?.focus());
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSubmit(event);
        }
    };

    const onSuggestionClick = async (suggestion) => {
        await sendQuestion(suggestion, 3);
        requestAnimationFrame(() => textareaRef.current?.focus());
    };

    const onQuickDraft = (suggestion) => {
        openAssistant(suggestion);
        requestAnimationFrame(() => textareaRef.current?.focus());
    };

    const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
    const assistantText = (lastAssistantMessage?.content || '').toLowerCase();
    const showQuickActions =
        messages.length === 0 ||
        assistantText.includes('necesito') ||
        assistantText.includes('próximo paso') ||
        assistantText.includes('proximo paso') ||
        assistantText.includes('no encontré') ||
        assistantText.includes('no encontre') ||
        assistantText.includes('referencia cercana') ||
        assistantText.includes('necesita');

    return (
        <div className="qa-floating">
            {isOpen && (
                <section className="qa-floating__panel ga-card" aria-label="Asistente IA de Calidad">
                    <header className="qa-floating__header">
                        <h2 className="qa-floating__title">
                            <CircleHelp size={18} />
                            Asistente IA de Calidad
                        </h2>

                        <div className="qa-floating__header-actions">
                            <button
                                type="button"
                                className="qa-floating__icon-btn"
                                onClick={clearConversation}
                                title="Limpiar conversación"
                                disabled={messages.length === 0}
                            >
                                <Eraser size={16} />
                            </button>
                            <button
                                type="button"
                                className="qa-floating__icon-btn"
                                onClick={toggleAssistant}
                                title="Minimizar"
                            >
                                <Minimize2 size={16} />
                            </button>
                            <button
                                type="button"
                                className="qa-floating__icon-btn"
                                onClick={closeAssistant}
                                title="Cerrar"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </header>

                    <div className="qa-floating__body">
                        <div className="qa-floating__hint">
                            Historial conversacional técnico basado en norma vigente. Enter envía, Shift + Enter agrega línea.
                        </div>

                        <div className="qa-floating__suggestions">
                            {suggestions.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    className="qa-floating__suggestion qa-floating__suggestion--send"
                                    onClick={() => onSuggestionClick(suggestion)}
                                    disabled={loading}
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>

                        {showQuickActions && (
                            <details className="qa-floating__quick-actions">
                                <summary className="qa-floating__quick-actions-label">Accesos rápidos</summary>
                                <div className="qa-floating__quick-actions-groups">
                                    {QUALITY_ASSISTANT_QUICK_GROUPS.map((group) => (
                                        <div key={group.label} className="qa-floating__quick-actions-group">
                                            <div className="qa-floating__quick-actions-group-label">{group.label}</div>
                                            <div className="qa-floating__quick-actions-grid">
                                                {group.items.map((item) => (
                                                    <button
                                                        key={item}
                                                        type="button"
                                                        className="qa-floating__quick-action"
                                                        onClick={() => onQuickDraft(item)}
                                                        disabled={loading}
                                                    >
                                                        {item}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}

                        <div className="qa-floating__messages">
                            {messages.length === 0 && (
                                <div className="qa-floating__empty">
                                    Consulta normas desde cualquier pantalla. Ejemplos: canto muerto COL, grieta FG4, tolerancia espesor Factory.
                                </div>
                            )}

                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`qa-floating__row qa-floating__row--${message.role === 'user' ? 'user' : 'assistant'}`}
                                >
                                    <article
                                        className={[
                                            'qa-floating__bubble',
                                            message.role === 'user' ? 'qa-floating__bubble--user' : 'qa-floating__bubble--assistant',
                                            message.isError ? 'qa-floating__bubble--error' : '',
                                        ].join(' ').trim()}
                                    >
                                        <p className="qa-floating__speaker">
                                            {message.role === 'user' ? 'Tú' : 'Asistente IA de Calidad'}
                                            {message.pending && <Loader2 size={13} className="animate-spin" />}
                                        </p>

                                        <p className="qa-floating__content">{message.content}</p>

                                        {message.role === 'assistant' && !message.pending && (
                                            <>
                                                <div className="qa-floating__meta">
                                                    {message.fuentePrincipal && (
                                                        <span className="ga-badge ga-badge--muted">
                                                            Fuente: {message.fuentePrincipal}
                                                        </span>
                                                    )}
                                                    {message.versionUtilizada && (
                                                        <span className="ga-badge ga-badge--muted">
                                                            Versión: {message.versionUtilizada}
                                                        </span>
                                                    )}
                                                    <span className={`ga-badge ${message.normaVigente ? 'ga-badge--ok' : 'ga-badge--warn'}`}>
                                                        {message.normaVigente ? 'Norma vigente' : 'Norma no confirmada'}
                                                    </span>
                                                </div>

                                                {Array.isArray(message.evidencias) && message.evidencias.length > 0 && (
                                                    <div className="qa-floating__evidences">
                                                        {message.evidencias.map((evidencia, index) => (
                                                            <details
                                                                key={`${message.id}-${evidencia.documento || 'doc'}-${index}`}
                                                                className="qa-floating__evidence"
                                                            >
                                                                <summary>
                                                                    Evidencia {index + 1}: {evidencia.documento || 'Documento'}
                                                                </summary>
                                                                <p className="u-muted" style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                                                                    {evidencia.fragmento || 'Sin fragmento disponible.'}
                                                                </p>
                                                                {formatScore(evidencia.score) && (
                                                                    <span className="ga-badge ga-badge--muted">
                                                                        Score: {formatScore(evidencia.score)}
                                                                    </span>
                                                                )}
                                                            </details>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </article>
                                </div>
                            ))}
                            <div ref={endRef} />
                        </div>

                        <div className="qa-floating__composer">
                            <form className="qa-floating__composer-form" onSubmit={handleSubmit}>
                                <textarea
                                    ref={textareaRef}
                                    className="ga-control qa-floating__textarea"
                                    rows={2}
                                    value={draft}
                                    onChange={(event) => setDraft(event.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Escribe tu consulta técnica..."
                                    disabled={loading}
                                />

                                <button
                                    type="submit"
                                    className="ga-btn ga-btn--primary qa-floating__send"
                                    disabled={loading || !draft.trim()}
                                    title="Enviar"
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <SendHorizontal size={16} />}
                                </button>
                            </form>

                            <div className="qa-floating__local-note">
                                Funciona sólo con el backend local y los documentos cargados en la aplicación.
                            </div>
                        </div>
                    </div>
                </section>
            )}

            <button
                type="button"
                className="ga-btn qa-floating__trigger"
                onClick={toggleAssistant}
                aria-expanded={isOpen}
                aria-controls="quality-assistant-floating"
            >
                <MessageCircle size={18} />
                <span>IA Normas</span>
            </button>
        </div>
    );
};

export default QualityAssistantFloating;
