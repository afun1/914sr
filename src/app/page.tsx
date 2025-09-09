import AuthProvider from "@/components/AuthProvider";
import AuthWrapper from "@/components/AuthWrapper";
import RecorderSelector from "@/components/RecorderSelector";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import BrowserCompatibilityCheck from "@/components/BrowserCompatibilityCheck";
import { NotificationProvider } from "@/components/NotificationSystem";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function Home() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <NotificationProvider>
          <AuthProvider>
            <BrowserCompatibilityCheck>
              <AuthWrapper>
                <RecorderSelector />
              </AuthWrapper>
            </BrowserCompatibilityCheck>
          </AuthProvider>
        </NotificationProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
