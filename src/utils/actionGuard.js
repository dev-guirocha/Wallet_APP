const activeActions = new Map();

export const isActionLocked = (key) => activeActions.has(String(key || ''));

export const runGuardedAction = async (key, fn) => {
  const actionKey = String(key || '');
  if (!actionKey || typeof fn !== 'function') {
    return { blocked: false, value: undefined };
  }

  if (activeActions.has(actionKey)) {
    return { blocked: true, value: undefined };
  }

  const promise = Promise.resolve().then(() => fn());
  activeActions.set(actionKey, promise);

  try {
    const value = await promise;
    return { blocked: false, value };
  } finally {
    if (activeActions.get(actionKey) === promise) {
      activeActions.delete(actionKey);
    }
  }
};

export const clearActionLocks = () => {
  activeActions.clear();
};

