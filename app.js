// CertiMagic app.js – Fully Corrected and Updated (CSV with Name & Email, Bulk Email via EmailJS, Placeholder Detection, Modern UI)

// Parse CSV with header support (Name, Email)
function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const nameIdx = headers.indexOf('name');
    const emailIdx = headers.indexOf('email');
    if (nameIdx === -1 || emailIdx === -1) {
        alert("CSV must have 'Name' and 'Email' columns.");
        return [];
    }
    return lines.slice(1).map(line => {
        const cols = line.split(',');
        return {
            name: cols[nameIdx] ? cols[nameIdx].trim() : '',
            email: cols[emailIdx] ? cols[emailIdx].trim() : ''
        };
    }).filter(r => r.name && r.email);
}

let templateImage = null;
let recipients = []; // [{name, email}]
let selectedFont = "'Dancing Script', cursive";
let fontSize = 48;
let fontColor = "#191654";
let fontY = 0.6;
let placeholderBox = null; // {x, y, width, height}
let placeholderDetectionInProgress = false;
let certificates = []; // [{name, email, dataUrl}]

// Font size, color, vertical position controls
document.getElementById('fontSize').addEventListener('input', function(e) {
    fontSize = parseInt(e.target.value);
    document.getElementById('fontSizeValue').textContent = fontSize;
});
document.getElementById('fontColor').addEventListener('input', function(e) {
    fontColor = e.target.value;
});
document.getElementById('fontY').addEventListener('input', function(e) {
    fontY = parseInt(e.target.value) / 100;
    document.getElementById('fontYValue').textContent = e.target.value;
});

// Template upload & placeholder detection
document.getElementById('templateUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            templateImage = new Image();
            templateImage.src = evt.target.result;
            templateImage.onload = () => {
                placeholderDetectionInProgress = true;
                document.getElementById('previewBtn').disabled = true;
                document.getElementById('generateBtn').disabled = true;
                document.getElementById('sendMailBtn').disabled = true;
                detectPlaceholder(templateImage);
            };
        };
        reader.readAsDataURL(file);
    }
});

// Names+Emails CSV upload
document.getElementById('namesUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            recipients = parseCSV(evt.target.result);
            updateButtonState();
        };
        reader.readAsText(file);
    }
});

// Font dropdown
document.getElementById('fontSelect').addEventListener('change', function(e) {
    selectedFont = e.target.value;
});

// Preview certificate for first recipient
document.getElementById('previewBtn').addEventListener('click', function() {
    if (!templateImage || recipients.length === 0) {
        alert('Please upload a template and a names list.');
        return;
    }
    drawCertificate(recipients[0].name, true);
});

// Generate all certificates and enable Send on Mail
document.getElementById('generateBtn').addEventListener('click', async function() {
    if (!templateImage || recipients.length === 0) {
        alert('Please upload a template and a names list.');
        return;
    }
    certificates = [];
    const zip = new JSZip();
    for (let i = 0; i < recipients.length; i++) {
        const dataUrl = await drawCertificate(recipients[i].name, false);
        certificates.push({
            name: recipients[i].name,
            email: recipients[i].email,
            dataUrl
        });
        const base64 = dataUrl.split(',')[1];
        zip.file(`${recipients[i].name}.png`, base64, { base64: true });
    }
    zip.generateAsync({ type: "blob" }).then(function(content) {
        saveAs(content, "certificates.zip");
        document.getElementById('sendMailBtn').disabled = false;
    });
});

// Send certificates by email using EmailJS
document.getElementById('sendMailBtn').addEventListener('click', async function() {
    if (!certificates.length) {
        alert('Please generate certificates first.');
        return;
    }
    const SERVICE_ID = 'service_40aksom';
    const TEMPLATE_ID = 'template_96vfgwt';
    let sent = 0,
        failed = 0;
    for (const cert of certificates) {
        const params = {
            to_name: cert.name,
            to_email: cert.email,
            certificate: cert.dataUrl // base64 PNG
        };
        try {
            await emailjs.send(SERVICE_ID, TEMPLATE_ID, params);
            sent++;
        } catch (err) {
            failed++;
            console.error(`Failed to send to ${cert.email}`, err);
        }
        await new Promise(res => setTimeout(res, 1200)); // Rate limit for free tier
    }
    alert(`Emails sent: ${sent}\nFailed: ${failed}`);
});

// Detect the [recipient.name] placeholder using Tesseract.js OCR (case-insensitive)
function detectPlaceholder(image) {
    placeholderBox = null;
    Tesseract.recognize(
        image,
        'eng', {
            logger: m => console.log(m)
        }
    ).then(({ data }) => {
        if (data && data.words) {
            for (let word of data.words) {
                const text = word.text.trim().toLowerCase();
                if (text === '[recipient.name]' || text === '[recipient.name]') {
                    placeholderBox = {
                        x: word.bbox.x0,
                        y: word.bbox.y0,
                        width: word.bbox.x1 - word.bbox.x0,
                        height: word.bbox.y1 - word.bbox.y0
                    };
                    console.log('Placeholder detected at:', placeholderBox);
                    break;
                }
            }
        }
        if (!placeholderBox) {
            console.warn('Could not detect placeholder. Using fallback position.');
            document.getElementById('previewArea').innerHTML =
                '<p class="warning">⚠️ Placeholder not detected. Using default position.</p>';
        }
        placeholderDetectionInProgress = false;
        updateButtonState();
    }).catch(error => {
        console.error('OCR Error:', error);
        placeholderDetectionInProgress = false;
        updateButtonState();
        document.getElementById('previewArea').innerHTML =
            '<p class="warning">⚠️ OCR processing failed. Using default position.</p>';
    });
}

// Draw certificate with name at detected position or fallback
function drawCertificate(name, preview) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = templateImage.width;
        canvas.height = templateImage.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(templateImage, 0, 0);

        if (placeholderBox) {
            // Cover the placeholder with background color
            ctx.fillStyle = "#fff";
            ctx.fillRect(placeholderBox.x, placeholderBox.y, placeholderBox.width, placeholderBox.height);

            // Draw the name at placeholder position
            ctx.font = `${fontSize}px ${selectedFont}`;
            ctx.fillStyle = fontColor;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
                name,
                placeholderBox.x + placeholderBox.width / 2,
                placeholderBox.y + placeholderBox.height / 2
            );
        } else {
            // Fallback position
            ctx.font = `${fontSize}px ${selectedFont}`;
            ctx.fillStyle = fontColor;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(name, canvas.width / 2, canvas.height * fontY);
        }

        if (preview) {
            document.getElementById('previewArea').innerHTML = '';
            canvas.className = 'certificate-canvas';
            document.getElementById('previewArea').appendChild(canvas);
        }
        resolve(canvas.toDataURL("image/png"));
    });
}

// Enable/disable buttons based on upload status and OCR
function updateButtonState() {
    const hasTemplate = !!templateImage;
    const hasNames = recipients.length > 0;
    const buttonsEnabled = hasTemplate && hasNames && !placeholderDetectionInProgress;

    document.getElementById('previewBtn').disabled = !buttonsEnabled;
    document.getElementById('generateBtn').disabled = !buttonsEnabled;
    // Only enable sendMailBtn after generation
    document.getElementById('sendMailBtn').disabled = certificates.length === 0;
}