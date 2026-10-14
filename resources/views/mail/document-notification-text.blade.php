{{-- Plain-text part: not HTML, so printed unescaped (an apostrophe must not become &#039;) --}}
TrackNGo Mati - City Government of Mati

Good day, {!! $recipientName !!}.

@foreach ($lines as $line)
{!! $line !!}
@endforeach
@if ($actionUrl)

{!! $actionText ?: 'Open TrackNGo' !!}: {!! $actionUrl !!}
@endif

This is an automated message from TrackNGo Mati. Please do not reply to this email.
