import { Alert } from 'react-native';
import { ApiError } from '../services/api';

export type ErrorAlertCallback = () => void | Promise<void>;

export interface ErrorAlertOptions {
  onRetry?: ErrorAlertCallback;
  title?: string;
}

/**
 * Show an error alert with 'OK' and optionally 'Retry' buttons
 * @param error - The error object (ApiError or any other error)
 * @param options - Optional: onRetry callback and title
 */
export const showErrorAlert = (error: unknown, options?: ErrorAlertOptions) => {
  const title = options?.title || 'Error';
  const onRetry = options?.onRetry;

  let message = 'Ocurrió un error desconocido';
  
  if (error instanceof ApiError) {
    message = error.getMessage();
  } else if (error instanceof Error) {
    message = error.message || 'Ocurrió un error desconocido';
  } else if (typeof error === 'string') {
    message = error;
  }

  const buttons: any[] = [];

  // Retry button (if callback provided)
  if (onRetry) {
    buttons.push({
      text: 'Volver a intentar',
      onPress: async () => {
        try {
          await onRetry();
        } catch (retryError) {
          showErrorAlert(retryError, options);
        }
      },
      style: 'default'
    });
  }

  // OK button (always present)
  buttons.push({
    text: 'OK',
    onPress: () => {},
    style: 'cancel'
  });

  Alert.alert(title, message, buttons);
};

/**
 * Helper function to extract error message
 * @param error - The error object
 * @returns Error message string
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.getMessage();
  }
  if (error instanceof Error) {
    return error.message || 'Ocurrió un error desconocido';
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Ocurrió un error desconocido';
};
