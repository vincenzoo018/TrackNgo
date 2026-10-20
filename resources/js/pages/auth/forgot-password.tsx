// Components
import { Form, Head } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { useRef } from 'react';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import TurnstileWidget from '@/components/turnstile-widget';
import type { TurnstileHandle } from '@/components/turnstile-widget';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppearance } from '@/hooks/use-appearance';
import { login } from '@/routes';
import { email } from '@/routes/password';

export default function ForgotPassword({
    status,
    turnstileSiteKey = null,
}: {
    status?: string;
    /** Cloudflare Turnstile public key; null when the captcha is off */
    turnstileSiteKey?: string | null;
}) {
    const captcha = useRef<TurnstileHandle>(null);
    const { resolvedAppearance } = useAppearance();

    return (
        <>
            <Head title="Forgot password" />

            {status && (
                <div className="mb-4 text-center text-sm font-medium text-green-600">
                    {status}
                </div>
            )}

            <div className="space-y-6">
                {/* A token passes only once: get a fresh one after every request */}
                <Form
                    {...email.form()}
                    onFinish={() => captcha.current?.reset()}
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    autoComplete="off"
                                    autoFocus
                                    placeholder="email@example.com"
                                />

                                <InputError message={errors.email} />
                            </div>

                            {turnstileSiteKey && (
                                <div className="mt-6 grid gap-2">
                                    {/* Posts the token in its own hidden turnstile_token input */}
                                    <TurnstileWidget
                                        ref={captcha}
                                        siteKey={turnstileSiteKey}
                                        action="password_reset"
                                        theme={resolvedAppearance}
                                    />
                                    <InputError
                                        message={errors.turnstile_token}
                                    />
                                </div>
                            )}

                            <div className="my-6 flex items-center justify-start">
                                <Button
                                    className="w-full"
                                    disabled={processing}
                                    data-test="email-password-reset-link-button"
                                >
                                    {processing && (
                                        <LoaderCircle className="h-4 w-4 animate-spin" />
                                    )}
                                    Email password reset link
                                </Button>
                            </div>
                        </>
                    )}
                </Form>

                <div className="space-x-1 text-center text-sm text-muted-foreground">
                    <span>Or, return to</span>
                    <TextLink href={login()}>log in</TextLink>
                </div>
            </div>
        </>
    );
}

ForgotPassword.layout = {
    title: 'Forgot password',
    description: 'Enter your email to receive a password reset link',
};
