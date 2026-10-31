document.addEventListener("DOMContentLoaded" , () =>{

    // Password Visibility Toggle
    function setupPasswordToggle(inputId, buttonId, iconId) {
        const input = document.getElementById(inputId);
        const button = document.getElementById(buttonId);
        const icon = document.getElementById(iconId);
        button.addEventListener('click', function() {
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('bi-eye');
                icon.classList.add('bi-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('bi-eye-slash');
                icon.classList.add('bi-eye');
            }
        });
    }

    setupPasswordToggle('currentPasswordEmail', 'toggleCurrentPasswordEmail', 'currentPasswordEmailEyeIcon');
    setupPasswordToggle('currentPassword', 'toggleCurrentPassword', 'currentPasswordEyeIcon');
    setupPasswordToggle('newPassword', 'toggleNewPassword', 'newPasswordEyeIcon');
    setupPasswordToggle('confirmPassword', 'toggleConfirmPassword', 'confirmPasswordEyeIcon');
    setupPasswordToggle('newPasswordAdd', 'toggleNewPasswordAdd', 'newPasswordAddEyeIcon');
    setupPasswordToggle('confirmPasswordAdd', 'toggleConfirmPasswordAdd', 'confirmPasswordAddEyeIcon');

    async function passwordSetting(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors(form);

            const formData = new FormData(form);
            const jsonData = Object.fromEntries(formData);
            // Trim all string values
            Object.keys(jsonData).forEach(key => {
                if (typeof jsonData[key] === 'string') {
                    jsonData[key] = jsonData[key].trim();
                }
            });

            // Use URL
            const URL = form.id === 'changePasswordForm' ? '/change-password' : '/add-password';

            try {
                const response = await fetch(URL, {
                    method: 'POST',
                    body: JSON.stringify(jsonData),
                    headers: { 'Content-Type': 'application/json' }
                });

                const data = await response.json();
                if (!response.ok || !data.success) {
                    displayFormErrors(form, data.errors);
                    Swal.fire('Error', data.message || 'Invalid form validations!', 'error');
                } else {
                    const successMessage = form.id === 'changePasswordForm' ? 
                        'Password changed successfully' : 'Password added successfully';
                    Swal.fire({
                        icon: 'success',
                        title: 'Success',
                        text: successMessage,
                        timer: 1000, 
                        timerProgressBar: true, 
                        showConfirmButton: false 
                    }).then(() => {
                        window.location.reload();
                    });
            }

            } catch (error) {
                console.error('Password operation error:', error);
                Swal.fire('Error', 'Something went wrong: ' + error.message, 'error');
            }
        });
    }

    const addPasswordForm = document.getElementById('addPasswordForm');
    if (addPasswordForm) {
        passwordSetting(addPasswordForm);
    }

    const changePasswordForm = document.getElementById('changePasswordForm'); 
    if (changePasswordForm) {
        passwordSetting(changePasswordForm);
    }

    // Email Update Form
    const updateEmailForm = document.getElementById('updateEmailForm');
    if (updateEmailForm) {
        let isOtpSent = false;

        updateEmailForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearErrors(updateEmailForm);

            const formData = new FormData(updateEmailForm);
            const jsonData = Object.fromEntries(formData);
            Object.keys(jsonData).forEach(key => {
                if (typeof jsonData[key] === 'string') {
                    jsonData[key] = jsonData[key].trim();
                }
            });

            try {
                // Show processing Swal
                const processingSwal = Swal.fire({
                    title: 'Processing...',
                    text: 'Please wait while we send the OTP',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                const url = isOtpSent ? '/verify-email-otp' : '/change-email';
                const response = await fetch(url, {
                    method: 'POST',
                    body: JSON.stringify(jsonData),
                    headers: { 'Content-Type': 'application/json' }
                });

                const data = await response.json();

                // Close the processing Swal
                await processingSwal.close();

                if (!response.ok || !data.success) {
                    displayFormErrors(updateEmailForm, data.errors);
                    await Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.message || 'Validation failed',
                        confirmButtonText:"Ok",
                        timer:1000
                    });
                    return;
                }

                if (!isOtpSent) {
                    document.getElementById('otpFieldEmail').style.display = 'block';
                    document.getElementById('updateEmailBtn').textContent = 'Verify OTP';
                    isOtpSent = true;

                    await Swal.fire({  
                        icon: 'success',
                    title: 'OTP Sent',
                    text: 'Please check your new email for the OTP',
                    showConfirmButton: false,
                    timer: 1000 
                    });
                } else {
                    await Swal.fire({
                        icon: 'success',
                        title: 'Success',
                        text: 'Email updated successfully',
                        showConfirmButton: false,
                        timer: 500
                    });
                    $('#updateEmailModal').modal('hide');
                    updateEmailForm.reset();
                    document.getElementById('otpFieldEmail').style.display = 'none';
                    document.getElementById('updateEmailBtn').textContent = 'Update';
                    isOtpSent = false;
                    window.location.reload();
                }
            } catch (error) {
                console.error('Email update error:', error);
                Swal.close();
                await Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Something went wrong: ' + error.message
                });
            }
        });
    }

    // Profile Image Zoom
    document.getElementById('largeProfileImg').addEventListener('click', function() {
        this.classList.toggle('zoomed');
    });

})

// Copy referral link functionality
const copyButton = document.getElementById('copyReferralLink');    
copyButton?.addEventListener('click', function() {

    navigator.clipboard.writeText(getFullReferralLink())
    .then(() =>{
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<i class="bi bi-check-lg me-1"></i> Copied!';
        setTimeout(() =>  copyButton.innerHTML = originalText , 2000);
    })
    .catch(err => console.error('Failed to copy: ', err));
});


// Share on WhatsApp
const shareWhatsApp = document.getElementById('shareWhatsApp');
if (shareWhatsApp) {
    shareWhatsApp.addEventListener('click', function() {
        const text = `Hey! Sign up using my referral link and get ₹100 rewards: ${getFullReferralLink()}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(whatsappUrl, '_blank');
    });
}

const getFullReferralLink = () => {
    const referralInput = document.getElementById('referralLink');
    const referralUrl = new URL('/signup', referralInput.dataset.baseUrl);
    referralUrl.searchParams.set('ref', referralInput.value.trim());
    return referralUrl.toString();
};

function displayFormErrors(form, errors) { 
    clearErrors(form);
    if (errors && typeof errors === 'object') {
        Object.entries(errors).forEach(([field, message]) => {
            const input = form.querySelector(`[name="${field}"]`);
            if (input) {
                input.classList.add('is-invalid');
                const parentDiv = input.closest('.mb-3');
                const feedback = parentDiv.querySelector('.invalid-feedback');
                if (feedback) {
                    feedback.textContent = message;
                    feedback.style.display = 'block'; 
                }
            }
        });
    }
}

function clearErrors(form) {
    form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    form.querySelectorAll('.invalid-feedback').forEach(el => {
        el.textContent = '';
        el.style.display = 'none'; 
    });
}

