// Mayor specific JS
function signDocument() {
    showToast('Applying E-Signature...', 'info');
    setTimeout(() => {
        showToast('Document Approved and Signed', 'success');
    }, 1500);
}

function bulkApprove() {
    showToast('Bulk approving documents...', 'info');
    setTimeout(() => {
        showToast('3 Documents Approved', 'success');
    }, 2000);
}
