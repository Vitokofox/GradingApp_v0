import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { consultarNormasIA } from '../services/iaDocumentalService';

const STORAGE_KEY = 'gradingapp-quality-assistant-state';

export const QUALITY_ASSISTANT_SUGGESTIONS = [
    'canto muerto COL',
    'grieta FG4',
    'tolerancia espesor Factory',
    'norma RIP',
];

export const QUALITY_ASSISTANT_QUICK_GROUPS = [
    {
        label: 'Defecto',
        items: ['canto muerto COL', 'grieta FG4', 'nudo muerto COP'],
    },
    {
        label: 'Tolerancia',
        items: ['tolerancia espesor Factory', 'tolerancia ancho RIP', 'tolerancia largo Board'],
    },
    {
        label: 'Producto',
        items: ['norma RIP', 'norma Board', 'norma Selección Seco'],
    },
];

const QualityAssistantContext = createContext(null);

const mkId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const sanitizeStoredMessages = (messages) => {
    if (!Array.isArray(messages)) {
        return [];
    }

    return messages
        .filter((message) => message && typeof message === 'object')
        .map((message) => ({
            id: message.id || mkId(),
            role: message.role === 'user' ? 'user' : 'assistant',
            content: typeof message.content === 'string' ? message.content : '',
            createdAt: Number(message.createdAt) || Date.now(),
            pending: false,
            isError: Boolean(message.isError),
            fuentePrincipal: typeof message.fuentePrincipal === 'string' ? message.fuentePrincipal : '',
            versionUtilizada: typeof message.versionUtilizada === 'string' ? message.versionUtilizada : '',
            normaVigente: Boolean(message.normaVigente),
            evidencias: Array.isArray(message.evidencias) ? message.evidencias : [],
        }));
};

const loadInitialState = () => {
    if (typeof window === 'undefined') {
        return { isOpen: false, draft: '', messages: [] };
    }

    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { isOpen: false, draft: '', messages: [] };
        }

        const parsed = JSON.parse(raw);
        return {
            isOpen: Boolean(parsed?.isOpen),
            draft: typeof parsed?.draft === 'string' ? parsed.draft : '',
            messages: sanitizeStoredMessages(parsed?.messages),
        };
    } catch {
        return { isOpen: false, draft: '', messages: [] };
    }
};

const normalizeAssistantContent = (data) => {
    const respuesta = (data?.respuesta || '').trim();
    if (!respuesta) {
        return 'No encontré una regla exacta en las normas cargadas.';
    }

    const lower = respuesta.toLowerCase();
    if (lower.includes('indice inexistente') || lower.includes('índice inexistente') || lower.includes('indice vacio') || lower.includes('índice vacío') || lower.includes('reconstruir')) {
        return 'Debe reconstruir el índice documental.';
    }

    if (lower.includes('no encontre una regla exacta')) {
        return 'No encontré una regla exacta en las normas cargadas.';
    }

    if (lower.includes('no hay documentos') || lower.includes('no se encontraron documentos')) {
        return 'No hay documentos cargados.';
    }

    return respuesta;
};

const normalizeErrorContent = (message) => {
    const text = (message || '').trim();
    const lower = text.toLowerCase();

    if (!text) {
        return 'No se pudo completar la consulta local de normas.';
    }

    if (lower.includes('indice') || lower.includes('índice') || lower.includes('reconstruir')) {
        return 'Debe reconstruir el índice documental.';
    }

    if (lower.includes('documentos') && (lower.includes('no hay') || lower.includes('no se encontraron'))) {
        return 'No hay documentos cargados.';
    }

    if (lower.includes('no encontre una regla exacta')) {
        return 'No encontré una regla exacta en las normas cargadas.';
    }

    if (lower.includes('timeout') || lower.includes('espera agotado')) {
        return 'La API local de normas tardó demasiado en responder.';
    }

    if (lower.includes('conectar') || lower.includes('failed to fetch') || lower.includes('cors')) {
        return 'No se pudo conectar con la API local de normas.';
    }

    return text;
};

export const QualityAssistantProvider = ({ children }) => {
    const initialState = useMemo(loadInitialState, []);
    const [isOpen, setIsOpen] = useState(initialState.isOpen);
    const [draft, setDraft] = useState(initialState.draft);
    const [messages, setMessages] = useState(initialState.messages);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const serializableMessages = messages.map((message) => ({
            ...message,
            pending: false,
        }));

        window.sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                isOpen,
                draft,
                messages: serializableMessages,
            }),
        );
    }, [draft, isOpen, messages]);

    const replaceMessage = (id, patch) => {
        setMessages((prev) => prev.map((message) => (message.id === id ? { ...message, ...patch } : message)));
    };

    const openAssistant = (nextDraft = '') => {
        setIsOpen(true);
        if (typeof nextDraft === 'string') {
            setDraft(nextDraft);
        }
    };

    const closeAssistant = () => {
        setIsOpen(false);
    };

    const toggleAssistant = () => {
        setIsOpen((prev) => !prev);
    };

    const clearConversation = () => {
        setMessages([]);
    };

    const sendQuestion = async (question, topK = 3) => {
        const trimmedQuestion = (question || '').trim();
        if (!trimmedQuestion || loading) {
            return false;
        }

        const userId = mkId();
        const pendingId = mkId();

        setIsOpen(true);
        setDraft('');
        setLoading(true);
        setMessages((prev) => [
            ...prev,
            {
                id: userId,
                role: 'user',
                content: trimmedQuestion,
                createdAt: Date.now(),
            },
            {
                id: pendingId,
                role: 'assistant',
                content: 'Analizando norma vigente...',
                pending: true,
                createdAt: Date.now() + 1,
                evidencias: [],
            },
        ]);

        try {
            const data = await consultarNormasIA(trimmedQuestion, topK);
            replaceMessage(pendingId, {
                pending: false,
                content: normalizeAssistantContent(data),
                fuentePrincipal: data?.fuentePrincipal || 'N/D',
                versionUtilizada: data?.versionUtilizada || 'N/D',
                normaVigente: Boolean(data?.normaVigente),
                evidencias: Array.isArray(data?.evidencias) ? data.evidencias.slice(0, 3) : [],
            });
            return true;
        } catch (error) {
            replaceMessage(pendingId, {
                pending: false,
                isError: true,
                content: normalizeErrorContent(error?.message),
                fuentePrincipal: 'N/D',
                versionUtilizada: 'N/D',
                normaVigente: false,
                evidencias: [],
            });
            return false;
        } finally {
            setLoading(false);
        }
    };

    const value = {
        isOpen,
        draft,
        messages,
        loading,
        setDraft,
        openAssistant,
        closeAssistant,
        toggleAssistant,
        clearConversation,
        sendQuestion,
        suggestions: QUALITY_ASSISTANT_SUGGESTIONS,
    };

    return (
        <QualityAssistantContext.Provider value={value}>
            {children}
        </QualityAssistantContext.Provider>
    );
};

export const useQualityAssistant = () => {
    const context = useContext(QualityAssistantContext);
    if (!context) {
        throw new Error('useQualityAssistant debe usarse dentro de QualityAssistantProvider.');
    }
    return context;
};
