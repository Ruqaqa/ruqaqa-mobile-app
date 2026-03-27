import { createContext, useContext } from 'react';
import { AppModule, UserPermissions } from '../types/permissions';

interface AppModuleContextValue {
  activeModule: AppModule;
  availableModules: AppModule[];
  canSwitch: boolean;
  permissions: UserPermissions;
  openSwitcher: () => void;
}

export const AppModuleContext = createContext<AppModuleContextValue>(
  null as any,
);

export function useAppModuleContext() {
  return useContext(AppModuleContext);
}
