<?php

/*
|--------------------------------------------------------------------------
| Document editing permissions
|--------------------------------------------------------------------------
|
| Who may edit a document's details (metadata) or upload a new version of its file. App\Policies\DocumentPolicy
| checks these on every request, so hiding a button is never the only protection. On top of the role, a person
| may only do it while the document is with them, or as its filer until the first recipient receives it; Admin
| edits details without holding the document. CART only monitors and never changes documents.
|
*/

return [
    'roles' => [
        'Receiving Clerk' => ['documents.edit_metadata', 'documents.create_revision'],
        'Department Head' => ['documents.edit_metadata', 'documents.create_revision'],
        'HR'              => ['documents.edit_metadata', 'documents.create_revision'],
        'Mayor'           => ['documents.create_revision'],
        'Admin'           => ['documents.edit_metadata'],
        'CART'            => [],
    ],

    // Roles that may upload a new version only of a document returned to them (the client brought a corrected file)
    'revision_only_when_returned' => ['Receiving Clerk'],
];
