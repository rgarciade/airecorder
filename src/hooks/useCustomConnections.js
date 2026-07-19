import { useCallback, useReducer, useState } from 'react';

const CUSTOM_PROVIDER_PREFIX = 'custom:';

export const CONNECTIONS_ACTIONS = {
  ADD: 'add',
  UPDATE: 'update',
  SET: 'set',
  STAGE_DELETE: 'stageDelete',
  CANCEL_DELETE: 'cancelDelete',
};

function isCustomProvider(provider) {
  return typeof provider === 'string' && provider.startsWith(CUSTOM_PROVIDER_PREFIX);
}

function getCustomProviderId(provider) {
  if (!isCustomProvider(provider)) return null;
  return provider.slice(CUSTOM_PROVIDER_PREFIX.length);
}

export function connectionsReducer(state, action) {
  switch (action.type) {
    case CONNECTIONS_ACTIONS.ADD:
      return [...state, action.connection];
    case CONNECTIONS_ACTIONS.UPDATE:
      return state.map((connection) =>
        connection.id === action.id ? { ...connection, ...action.updates } : connection
      );
    case CONNECTIONS_ACTIONS.SET:
      return action.connections;
    default:
      return state;
  }
}

export function stagedDeletionsReducer(state, action) {
  switch (action.type) {
    case CONNECTIONS_ACTIONS.STAGE_DELETE:
      return state.includes(action.id) ? state : [...state, action.id];
    case CONNECTIONS_ACTIONS.CANCEL_DELETE:
      return state.filter((id) => id !== action.id);
    default:
      return state;
  }
}

export function validateCustomConnectionsSave({
  connections,
  stagedDeletions,
  aiProvider,
  embeddingProvider,
}) {
  if (!aiProvider) {
    return { blocked: true, error: 'settings.customConnections.errors.noAiProvider' };
  }

  const activeCustomIds = new Set();
  const chatId = getCustomProviderId(aiProvider);
  if (chatId) activeCustomIds.add(chatId);
  const embeddingId = getCustomProviderId(embeddingProvider);
  if (embeddingId) activeCustomIds.add(embeddingId);

  for (const id of stagedDeletions) {
    if (activeCustomIds.has(id)) {
      return { blocked: true, error: 'settings.customConnections.errors.deletedConnectionInUse' };
    }
  }

  return { blocked: false, error: null };
}

export function buildCustomConnectionsSavePayload({
  connections,
  stagedDeletions,
  aiProvider,
  embeddingProvider,
  customGeneralModel,
  embeddingModel,
}) {
  const validation = validateCustomConnectionsSave({
    connections,
    stagedDeletions,
    aiProvider,
    embeddingProvider,
  });

  if (validation.blocked) {
    return { validation, payload: null };
  }

  const payload = {
    customConnections: connections.filter((connection) => !stagedDeletions.includes(connection.id)),
    aiProvider,
    embeddingProvider,
    customGeneralModel,
    embeddingModel,
  };

  return { validation, payload };
}

export function useCustomConnections(initialConnections = []) {
  const [connections, dispatchConnections] = useReducer(connectionsReducer, initialConnections);
  const [stagedDeletions, dispatchStagedDeletions] = useReducer(stagedDeletionsReducer, []);
  const [testingConnectionId, setTestingConnectionId] = useState(null);
  const [testResults, setTestResults] = useState({});

  const setConnections = useCallback((connections) => {
    dispatchConnections({ type: CONNECTIONS_ACTIONS.SET, connections });
  }, []);

  const addConnection = useCallback((connection) => {
    dispatchConnections({ type: CONNECTIONS_ACTIONS.ADD, connection });
  }, []);

  const updateConnection = useCallback((id, updates) => {
    dispatchConnections({ type: CONNECTIONS_ACTIONS.UPDATE, id, updates });
  }, []);

  const stageDelete = useCallback((id) => {
    dispatchStagedDeletions({ type: CONNECTIONS_ACTIONS.STAGE_DELETE, id });
  }, []);

  const cancelDelete = useCallback((id) => {
    dispatchStagedDeletions({ type: CONNECTIONS_ACTIONS.CANCEL_DELETE, id });
  }, []);

  const testConnection = useCallback(async (id) => {
    setTestingConnectionId(id);
    setTestResults((previous) => ({
      ...previous,
      [id]: { status: 'loading', models: [], error: null },
    }));

    try {
      const result = await window.electronAPI.listCustomModels(id);
      if (result?.success) {
        const models = result.models || [];
        setTestResults((previous) => ({
          ...previous,
          [id]: { status: 'success', models, error: null },
        }));
        return { success: true, models };
      }
      const error = result?.error || 'Unknown error';
      setTestResults((previous) => ({
        ...previous,
        [id]: { status: 'error', models: [], error },
      }));
      return { success: false, error };
    } catch (error) {
      const message = error?.message || 'Unknown error';
      setTestResults((previous) => ({
        ...previous,
        [id]: { status: 'error', models: [], error: message },
      }));
      return { success: false, error: message };
    } finally {
      setTestingConnectionId(null);
    }
  }, []);

  const getConnectionsToSave = useCallback(
    () => connections.filter((connection) => !stagedDeletions.includes(connection.id)),
    [connections, stagedDeletions]
  );

  const validateSave = useCallback(
    ({ aiProvider, embeddingProvider }) =>
      validateCustomConnectionsSave({
        connections,
        stagedDeletions,
        aiProvider,
        embeddingProvider,
      }),
    [connections, stagedDeletions]
  );

  return {
    connections,
    stagedDeletions,
    setConnections,
    addConnection,
    updateConnection,
    stageDelete,
    cancelDelete,
    testConnection,
    testingConnectionId,
    testResults,
    getConnectionsToSave,
    validateSave,
  };
}
