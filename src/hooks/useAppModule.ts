import { useState, useCallback, useMemo } from 'react';
import { AppModule } from '../types/permissions';
import { usePermissions } from '../services/authContext';
import { getAvailableModules } from '../services/permissionService';

/**
 * Manages which module (Finance / Gallery) is active.
 * Returns available modules based on permissions and a switcher function.
 */
export function useAppModule() {
  const permissions = usePermissions();
  const available = useMemo(
    () => (permissions ? getAvailableModules(permissions) : []),
    [permissions],
  );

  const [activeModule, setActiveModule] = useState<AppModule>(
    available[0] ?? 'finance',
  );

  const switchModule = useCallback(
    (mod: AppModule) => {
      if (available.includes(mod)) {
        setActiveModule(mod);
      }
    },
    [available],
  );

  const canSwitch = available.length > 1;

  return { activeModule, switchModule, availableModules: available, canSwitch };
}
