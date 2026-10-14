<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>TrackNGo Mati</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:Arial, Helvetica, sans-serif; color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding:24px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border:1px solid #e2e8f0; border-radius:8px;">
                    <tr>
                        <td style="background-color:#1e3a5f; border-radius:8px 8px 0 0; padding:18px 24px;">
                            <div style="font-size:18px; font-weight:bold; color:#ffffff;">TrackNGo Mati</div>
                            <div style="font-size:12px; color:#bfdbfe; margin-top:2px;">City Government of Mati &middot; Document Management and Monitoring System</div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px; font-size:14px; line-height:1.6;">
                            <p style="margin:0 0 14px;">Good day, {{ $recipientName }}.</p>
                            @foreach ($lines as $line)
                                <p style="margin:0 0 10px;">{{ $line }}</p>
                            @endforeach
                            @if ($actionUrl)
                                <p style="margin:22px 0 6px;">
                                    <a href="{{ $actionUrl }}" style="display:inline-block; background-color:#2563eb; color:#ffffff; text-decoration:none; font-weight:bold; padding:10px 18px; border-radius:6px;">{{ $actionText ?: 'Open TrackNGo' }}</a>
                                </p>
                                <p style="margin:0; font-size:12px; color:#64748b; word-break:break-all;">{{ $actionUrl }}</p>
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td style="border-top:1px solid #e2e8f0; padding:14px 24px; font-size:11px; line-height:1.5; color:#64748b;">
                            This is an automated message from TrackNGo Mati. Please do not reply to this email.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
