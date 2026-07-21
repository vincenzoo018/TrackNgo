// Receiving specific JS
function generateQRCode() {
    showToast('Generating QR Code...', 'info');
    setTimeout(() => {
        document.getElementById('qr-placeholder').style.display = 'none';
        document.getElementById('qr-result').style.display = 'block';
        showToast('QR Code Generated', 'success');
    }, 1000);
}

function printRoutingSlip() {
    window.print();
}
