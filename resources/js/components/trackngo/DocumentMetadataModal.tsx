import { router, usePage } from '@inertiajs/react';
import { Lock, PencilLine } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { requestJson } from '@/lib/request';
import { BaseModal, ModalField, ModalPrimaryButton, ModalSecondaryButton, ModalSection } from './BaseModal';

type Props = {
    open: boolean;
    onClose: () => void;
    doc: any;
    onSaved: (message: string) => void;
};

/**
 * Editable details; everything else (tracking number, filing date and filer, signatures, routing) stays as
 * recorded. Contact details stay editable after signing; the rest is what the signatories approved.
 */
type ContentKey = 'title' | 'type_id' | 'first_name' | 'middle_name' | 'last_name' | 'suffix' | 'organization' | 'purpose';
const CONTACT_KEYS = ['contact_number', 'email'] as const;
type Key = ContentKey | typeof CONTACT_KEYS[number];
const CLIENT_KEYS: Key[] = ['first_name', 'middle_name', 'last_name', 'suffix', 'organization', 'purpose', 'contact_number', 'email'];

const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)] disabled:bg-slate-50 disabled:text-slate-500';

function initialValues(doc: any): Record<Key, string> {
    const client = doc?.client || {};

    return {
        title: doc?.title ?? '',
        type_id: String(doc?.type_id ?? ''),
        first_name: client.first_name ?? '',
        middle_name: client.middle_name ?? '',
        last_name: client.last_name ?? '',
        suffix: client.suffix ?? '',
        organization: client.organization ?? '',
        purpose: client.purpose ?? '',
        contact_number: client.contact_number ?? '',
        email: client.email ?? '',
    };
}

/**
 * Edit Metadata (PUT /documents/{id}/metadata). Shown only to whoever may edit the document now; the server
 * checks again. Once the current version is signed only the applicant's contact details can change.
 */
export function DocumentMetadataModal({ open, onClose, doc, onSaved }: Props) {
    const { dbDocumentTypes } = usePage<any>().props;
    const types: any[] = dbDocumentTypes || [];
    const contentLocked = !doc?.abilities?.edit_content;
    const hasClient = Boolean(doc?.client);
    // The page remounts the dialog each time it opens, so it starts from the document as it is now
    const [values, setValues] = useState<Record<Key, string>>(() => initialValues(doc));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const original = useMemo(() => initialValues(doc), [doc]);
    const editable = (key: Key) => (CONTACT_KEYS as readonly string[]).includes(key) || !contentLocked;
    const changed = (Object.keys(values) as Key[]).filter(key => editable(key) && values[key].trim() !== original[key].trim());
    const set = (key: Key) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setValues(prev => ({ ...prev, [key]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (changed.length === 0) {
            return;
        }

        // Only what changed is sent
        const payload: Record<string, any> = {};
        const client: Record<string, string> = {};
        changed.forEach(key => {
            if (CLIENT_KEYS.includes(key)) {
                client[key] = values[key].trim();
            } else {
                payload[key] = values[key].trim();
            }
        });

        if (Object.keys(client).length > 0) {
            payload.client = client;
        }

        setSaving(true);
        setError(null);

        try {
            const data = await requestJson(`/documents/${doc.document_id}/metadata`, 'PUT', payload);
            onSaved(data?.message || 'Details updated.');
            onClose();
            router.reload({ only: ['dbDocument', 'dbAuditTrail'] });
        } catch (err: any) {
            setError(err?.message || 'The details could not be saved.');
        } finally {
            setSaving(false);
        }
    };

    const field = (key: Key, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, required = false) => (
        <ModalField label={label} required={required && editable(key)}>
            <input value={values[key]} onChange={set(key)} disabled={!editable(key)} className={input} {...props} />
        </ModalField>
    );

    return (
        <BaseModal
            isOpen={open}
            onClose={saving ? () => {} : onClose}
            title="Edit Metadata"
            identifier={doc?.reference_number}
            description="Correct the details recorded for this document. Every change is saved in the audit trail."
            icon={<PencilLine className="h-5 w-5" />}
            maxWidth="max-w-2xl"
            formProps={{ onSubmit: handleSubmit }}
            footer={
                <>
                    <ModalSecondaryButton onClick={onClose} disabled={saving} />
                    <ModalPrimaryButton isLoading={saving} loadingText="Saving..." disabled={changed.length === 0}>
                        Save Changes
                    </ModalPrimaryButton>
                </>
            }
        >
            <div className="space-y-5">
                {contentLocked && doc?.abilities?.content_locked_reason && (
                    <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{doc.abilities.content_locked_reason}</span>
                    </p>
                )}
                {error && (
                    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">{error}</p>
                )}

                <ModalSection title="Document">
                    {field('title', 'Title', { maxLength: 150 }, true)}
                    <ModalField
                        label="Document Type"
                        required={!contentLocked}
                        description={values.type_id !== original.type_id ? 'The ARTA processing period follows the new document type.' : undefined}
                    >
                        <select value={values.type_id} onChange={set('type_id')} disabled={contentLocked} className={input}>
                            {types.map(t => <option key={t.type_id} value={String(t.type_id)}>{t.type_name}</option>)}
                        </select>
                    </ModalField>
                </ModalSection>

                {hasClient && (
                    <>
                        <ModalSection title="Applicant">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_90px]">
                                {field('first_name', 'First Name', { maxLength: 60 }, true)}
                                {field('middle_name', 'Middle Name', { maxLength: 60 })}
                                {field('last_name', 'Last Name', { maxLength: 60 }, true)}
                                {field('suffix', 'Suffix', { maxLength: 10 })}
                            </div>
                            {field('organization', 'Organization / Company', { maxLength: 150 })}
                            <ModalField label="Purpose" required={!contentLocked}>
                                <textarea rows={2} maxLength={255} value={values.purpose} onChange={set('purpose')} disabled={contentLocked} className={input} />
                            </ModalField>
                        </ModalSection>

                        <ModalSection title="Contact" description="The applicant is texted at this number when the document is ready for pickup and when it is released.">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {field('contact_number', 'Contact Number', { inputMode: 'tel', placeholder: '09XX XXX XXXX' }, true)}
                                {field('email', 'Email Address', { type: 'email', maxLength: 100 })}
                            </div>
                        </ModalSection>
                    </>
                )}

                <p className="text-[12px] text-slate-500">
                    The tracking number, filing date, filer, signatures and routing history cannot be changed.
                </p>
            </div>
        </BaseModal>
    );
}
