export type EmployeeFieldValues = {
    first_name: string;
    middle_name: string;
    last_name: string;
    email: string;
    department_id: string | number;
    role_id: string | number;
    mobile_number: string;
    password: string;
};

type Props = {
    data: EmployeeFieldValues;
    setData: (field: keyof EmployeeFieldValues, value: string) => void;
    errors: Partial<Record<string, string>>;
    departments: any[];
    roles: any[];
    passwordPlaceholder: string;
};

/** Name, contact, department / role and password fields of the HR Add and Edit Employee pages. */
export function EmployeeFormFields({ data, setData, errors, departments, roles, passwordPlaceholder }: Props) {
    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 md:col-span-2">
                    <label className="text-sm font-medium text-[var(--tng-slate-700)]">Employee Name</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <input
                                type="text"
                                maxLength={60}
                                value={data.first_name}
                                onChange={e => setData('first_name', e.target.value)}
                                className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.first_name ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                                placeholder="First Name (e.g. Juan)"
                            />
                            {errors.first_name && <p className="text-xs text-red-500">{errors.first_name}</p>}
                        </div>
                        <div className="space-y-1">
                            <input
                                type="text"
                                maxLength={60}
                                value={data.middle_name}
                                onChange={e => setData('middle_name', e.target.value)}
                                className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.middle_name ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                                placeholder="Middle Name (Optional)"
                            />
                            {errors.middle_name && <p className="text-xs text-red-500">{errors.middle_name}</p>}
                        </div>
                        <div className="space-y-1">
                            <input
                                type="text"
                                maxLength={60}
                                value={data.last_name}
                                onChange={e => setData('last_name', e.target.value)}
                                className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.last_name ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                                placeholder="Last Name (e.g. Dela Cruz)"
                            />
                            {errors.last_name && <p className="text-xs text-red-500">{errors.last_name}</p>}
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--tng-slate-700)]">Email Address</label>
                    <input
                        type="email"
                        maxLength={100}
                        value={data.email}
                        onChange={e => setData('email', e.target.value)}
                        className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.email ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                        placeholder="juan@mati.gov.ph"
                    />
                    {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--tng-slate-700)]">Department</label>
                    <select
                        value={data.department_id}
                        onChange={e => setData('department_id', e.target.value)}
                        className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.department_id ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                    >
                        <option value="">Select Department</option>
                        {departments.map(dept => (
                            <option key={dept.department_id} value={dept.department_id}>{dept.department_name}</option>
                        ))}
                    </select>
                    {errors.department_id && <p className="text-xs text-red-500">{errors.department_id}</p>}
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--tng-slate-700)]">System Role</label>
                    <select
                        value={data.role_id}
                        onChange={e => setData('role_id', e.target.value)}
                        className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.role_id ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                    >
                        <option value="">Select Role</option>
                        {roles.map(role => (
                            <option key={role.role_id} value={role.role_id}>{role.role_name}</option>
                        ))}
                    </select>
                    {errors.role_id && <p className="text-xs text-red-500">{errors.role_id}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--tng-slate-700)]">Mobile Number (Optional)</label>
                    <input
                        type="text"
                        value={data.mobile_number}
                        onChange={e => setData('mobile_number', e.target.value)}
                        className="w-full rounded-xl border border-[var(--tng-slate-200)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                        placeholder="09171234567"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--tng-slate-700)]">Password</label>
                    <input
                        type="password"
                        value={data.password}
                        onChange={e => setData('password', e.target.value)}
                        className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.password ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                        placeholder={passwordPlaceholder}
                    />
                    {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                </div>
            </div>
        </>
    );
}
