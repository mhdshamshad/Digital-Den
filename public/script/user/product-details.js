function changeMainImage(thumbnail) {
    const mainImage = document.getElementById('mainImage');
    if (mainImage) {
        mainImage.src = thumbnail.src;
        document.querySelectorAll('.thumbnail').forEach(thumb => thumb.classList.remove('active'));
        thumbnail.classList.add('active');
    }
}

// Define addToCart globally
function addToCart(productId) {
    const quantityInput = document.getElementById("quantity");
    const quantity = quantityInput ? quantityInput.value : 1; 
    fetch("/cart/add", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId, quantity })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: data.message || 'Product added to cart successfully!',
                timer: 1000,
                showConfirmButton: false
            });

        } else {
            Swal.fire({ 
                icon: "warning",title:data.message || 'Failed to load reviews', 
                showConfirmButton: "OK",timer:1500, timerProgressBar: true
            })
            .then(() => {      
                if(data.redirect) window.location = data.redirect
                else if(data.redirectUrl){
                    location.href = data.redirectUrl;
                }   
            })  
        }
    })
    .catch(err => {
        console.error('Error:', err);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'An error occurred. Please try again.',
            timer: 1000,
            showConfirmButton: false
        });
    });
}

// Define addToCart globally
function addtoWishlist(productId) {
    fetch("/wishlist/add", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: data.message || 'Product added to wishlist successfully!',
                timer: 1200,
                showConfirmButton: "OK"
            });
        } else {
            Swal.fire({ 
                icon: "warning", title:data.message || 'Failed to load reviews', 
                showConfirmButton: "OK",timer:1500, timerProgressBar: true
            })
            .then(() => {      
                if(data.redirect) window.location = data.redirect
                else if(data.redirectUrl){
                    location.href = data.redirectUrl;
                }   
            })
        }
    })
    .catch(err => {
        console.error('Error:', err);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'An error occurred. Please try again.',
            timer: 1000,
            showConfirmButton: true
        });
    });
}  

function displayFormErrors(form, errors) {
    clearErrors(form);
    if (errors && typeof errors === 'object') {
        Object.entries(errors).forEach(([field, message]) => {
            const input = form.querySelector(`[name="${field}"]`);
            if (input) {
                input.classList.add('is-invalid');
                const feedback = input.nextElementSibling;
                if (feedback?.classList.contains('invalid-feedback')) {
                    feedback.textContent = message;
                }
            }
        });
    }
} 

function clearErrors(form) {
    form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    form.querySelectorAll('.invalid-feedback').forEach(el => el.textContent = '');
}


document.addEventListener('DOMContentLoaded', function() {

    let productQuanity = document.querySelector(".stock-status #productQuanity").value;

    const zoomContainers = document.querySelectorAll('.zoom-container');
        zoomContainers.forEach(container => {
            const img = container.querySelector('#mainImage');
            const lens = container.querySelector('.zoom-lens');
            const zoomFactor = 2; 

            img.addEventListener('load', () => {
                container.addEventListener('mousemove', moveLens);
                container.addEventListener('mouseleave', hideLens);
                container.addEventListener('mouseenter', showLens);
            });

            function moveLens(e) {
                e.preventDefault();

                const rect = container.getBoundingClientRect();
                const imgRect = img.getBoundingClientRect();

                // Mouse position relative to the container
                let posX = e.clientX - rect.left;
                let posY = e.clientY - rect.top;

                // Calculate image's actual dimensions with object-fit: contain
                const imgWidth = img.naturalWidth;
                const imgHeight = img.naturalHeight;
                const containerWidth = rect.width;
                const containerHeight = rect.height;

                // Compute the displayed image size (considering object-fit: contain)
                const ratio = Math.min(containerWidth / imgWidth, containerHeight / imgHeight);
                const displayWidth = imgWidth * ratio;
                const displayHeight = imgHeight * ratio;
                const offsetX = (containerWidth - displayWidth) / 2;
                const offsetY = (containerHeight - displayHeight) / 2;

                // Adjust posX and posY to be relative to the actual image content
                posX = Math.max(offsetX, Math.min(posX, offsetX + displayWidth));
                posY = Math.max(offsetY, Math.min(posY, offsetY + displayHeight));

                // Lens position
                const lensWidth = lens.offsetWidth;
                const lensHeight = lens.offsetHeight;
                let lensX = posX - lensWidth / 2;
                let lensY = posY - lensHeight / 2;

                // Keep lens within container bounds
                lensX = Math.max(0, Math.min(lensX, containerWidth - lensWidth));
                lensY = Math.max(0, Math.min(lensY, containerHeight - lensHeight));

                lens.style.left = `${lensX}px`;
                lens.style.top = `${lensY}px`;

                // Calculate the background position for the lens
                const bgPosX = ((posX - offsetX) / displayWidth) * imgWidth * zoomFactor - lensWidth / 2;
                const bgPosY = ((posY - offsetY) / displayHeight) * imgHeight * zoomFactor - lensHeight / 2;

                lens.style.backgroundImage = `url(${img.src})`;
                lens.style.backgroundSize = `${imgWidth * zoomFactor}px ${imgHeight * zoomFactor}px`;
                lens.style.backgroundPosition = `-${bgPosX}px -${bgPosY}px`;
            }

            function hideLens() {
                lens.style.opacity = '0';
            }

            function showLens() {
                lens.style.opacity = '1';
            }               
        });

        // Quantity Controls
        const quantityInput = document.getElementById('quantity');
        if (quantityInput) {
            document.getElementById('quantity-minus').addEventListener('click', () => {
                let value = parseInt(quantityInput.value);
                if (value > 1) quantityInput.value = value - 1;
            });

            document.getElementById('quantity-plus').addEventListener('click', () => {
                let value = parseInt(quantityInput.value);
                if (value < productQuanity){
                    quantityInput.value = value + 1;
                }
            });

            quantityInput.addEventListener('change', () => {
                let value = parseInt(quantityInput.value);
                if (value < 1) {
                    quantityInput.value = 1
                }
                if (value > productQuanity ){
                    quantityInput.value = productQuanity;
                } 
            });
        } 
        
    const editRatingStars = document.querySelectorAll('.edit-rating-star');
    editRatingStars.forEach(star => {
        star.addEventListener('click', function() {
            const rating = parseInt(this.getAttribute('data-rating'));
            document.getElementById('editRatingInput').value = rating;
            
            // Update star appearance
            editRatingStars.forEach(s => {
                if (parseInt(s.getAttribute('data-rating')) <= rating) {
                    s.classList.remove('far');
                    s.classList.add('fas');
                    s.classList.add('active');
                } else {
                    s.classList.remove('fas');
                    s.classList.add('far');
                    s.classList.remove('active');
                }
            });
        });
    });

    const editReviewModal = document.getElementById('editReviewModal');
    let reviewId ;
    editReviewModal.addEventListener('show.bs.modal', (event) => {
        const button = event.relatedTarget;
        reviewId = button.getAttribute('data-id');
        const form = document.getElementById('editReviewForm');

        form.elements['rating'].value = button.getAttribute('data-rating');
        form.elements['reviewTitle'].value = button.getAttribute('data-title');
        form.elements['reviewText'].value = button.getAttribute('data-feedback');
    });
    // edit review
    const editReviewForm = document.getElementById('editReviewForm');
    editReviewForm.addEventListener('submit',async (e) => {
        e.preventDefault();
        clearErrors(editReviewForm);

        const formData = new FormData(editReviewForm);
        const jsonData = Object.fromEntries(formData);
        // trim all values 
        Object.keys(jsonData).forEach(key => {
            if (typeof jsonData[key] === 'string') {
                jsonData[key] = jsonData[key].trim();
            }
        });

        try {
            const response = await fetch(`/product/editReview/${reviewId}`, {
                method: 'PATCH',
                body: JSON.stringify(jsonData),
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                displayFormErrors(editReviewForm, data.errors);
                Swal.fire({ 
                    icon: "error", title:"Error", text:data.message || 'Invalid form validations..!', 
                    showConfirmButton: "OK",timer:1500, timerProgressBar: true
                })
                .then(() => {      
                    if(data.redirect) window.location = data.redirect
                    
                })
            } else {
                bootstrap.Modal.getInstance(document.getElementById('editReviewModal')).hide();
                Swal.fire({
                    title: 'Success',
                    text:  data.message || 'Review edited successfully',
                    icon: 'success',
                    timer: 1200,
                    showConfirmButton: "OK"
                })
                .then(() => location.reload());
            }
        } catch (error) {
            console.error('edit review error:', error);
            Swal.fire('Error', 'Something went wrong: ' + error.message, 'error');
        }
    });


    // delete review 
    const deleteReviewModal = document.getElementById('deleteReviewModal');
    deleteReviewModal.addEventListener('show.bs.modal', (event) => {
        const button = event.relatedTarget;
        reviewId = button.getAttribute('data-id');
    });

    document.getElementById("confirmDeleteReviewBtn").
      addEventListener("click",async ()=> {
        try {
            const response = await fetch(`/product/deleteReview/${reviewId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                Swal.fire({ 
                    icon: "error", title:"Error", text:data.message || 'Unable to delete Review..!', 
                    showConfirmButton: "OK",timer:1500, timerProgressBar: true
                })
                .then(() => {      
                    if(data.redirect) window.location = data.redirect   
                })
            } else {
                bootstrap.Modal.getInstance(document.getElementById('deleteReviewModal')).hide();
                Swal.fire({
                    title: 'Success',
                    text:  data.message || 'Review deleted successfully',
                    icon: 'success',
                    timer: 1200,
                    showConfirmButton: "OK"
                })
                .then(() => location.reload());
            }
        } catch (error) {
            console.error('delete Review error:', error);
            Swal.fire('Error', 'Something went wrong: ' + error.message, 'error');
        }
    })


    // Star rating selection
    let selectedRating = 0;
    const ratingStars = document.querySelectorAll(".rating-star");
    ratingStars.forEach(star => {
        star.addEventListener('click', function() {
            const rating = this.getAttribute('data-rating');
            selectedRating = rating;
            
            // Reset all stars
            ratingStars.forEach(s => {
                s.classList.remove('fas', 'active');
                s.classList.add('far');
            });
            
            // Fill stars up to selected rating
            for (let i = 0; i < rating; i++) {
                ratingStars[i].classList.remove('far');
                ratingStars[i].classList.add('fas', 'active');
            }
        });
        
        // Hover effect
        star.addEventListener('mouseover', function() {
            const rating = this.getAttribute('data-rating');
            
            // Fill stars up to hovered rating
            for (let i = 0; i < rating; i++) {
                ratingStars[i].classList.remove('far');
                ratingStars[i].classList.add('fas');
            }
        });
        
        star.addEventListener('mouseout', function() {
            // Reset to active state only
            ratingStars.forEach(s => {
                if (!s.classList.contains('active')) {
                    s.classList.remove('fas');
                    s.classList.add('far');
                }
            });
        });
    });
    

    const productId = document.getElementById("currentProduct").value;
    let currentPage = 1;
    const reviewsPerPage = 5;
    let isLoading = false;
    let hasMoreReviews = true;

    //  reviews tab 
    const reviewsTab = document.getElementById('reviews-tab');
    reviewsTab.addEventListener('click', function() {
        currentPage = 1;
        hasMoreReviews = true;
        
        // Clear existing reviews
        const reviewList = document.getElementById("reviewList");
        reviewList.innerHTML = '';
        
        // Fetch initial reviews
        fetchReviews();
    });

    //  the filter 
    const typeFilter = document.getElementById('typeFilter');
    typeFilter.addEventListener('change', function() {
        currentPage = 1;
        hasMoreReviews = true;
        
        const reviewList = document.getElementById("reviewList");
        reviewList.innerHTML = '';

        fetchReviews();
    });

    // Load more reviews button
    const loadMoreBtn = document.getElementById('loadMoreReviews');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', function() {
            if (isLoading || !hasMoreReviews) return;
            
            // Increment page number
            currentPage++;
            
            // Show loading state
            this.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Loading...';
            
            // Fetch next page of reviews
            fetchReviews(false);
        });
    }


    document.querySelectorAll(".progress-bar").forEach(bar => {
        const percentage = parseFloat(bar.dataset.percentage) || 0;
        bar.style.width = percentage + "%";

        if (percentage >= 50) {
            bar.classList.add("bg-success");
        } else if (percentage >= 20) {
            bar.classList.add("bg-warning");
        } else {
            bar.classList.add("bg-danger");
        }
    });

    // fetch reviews
    async function fetchReviews(resetList = true) {
        if (isLoading) return;
        isLoading = true;
        
        const type = document.getElementById('typeFilter').value;
        const queryParams = new URLSearchParams({
            type,
            page: currentPage,
            limit: reviewsPerPage
        }).toString();
        
        try {
            // Show loading state on button
            if (loadMoreBtn) {
                loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Loading...';
            }
            
            const response = await fetch(`/product/${productId}/reviews?${queryParams}`, {
                headers: {'X-Requested-With': 'XMLHttpRequest'},
            });
            const data = await response.json();

            console.log("data" , data)
            if (!response.ok) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: data.message || 'Failed to fetch reviews',
                });
                return;
            }

            const reviewList = document.getElementById("reviewList");
            
            const currentUserId =  data.user === undefined ?  undefined : data.user._id ;

            // Check if we have reviews
            if (data.reviews?.length > 0) {
                hasMoreReviews = data.hasMore;

                const reviewsHTML = data.reviews.map(review => {
                    // star
                    const starRating = generateStarRating(review.rating);  
                    // Format date
                    const reviewDate = new Date(review.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    
                    // username icon
                    const userInitials = review.user?.username ? review.user.username.substring(0, 1).toUpperCase() : 'U';
   
                    // Profile 
                    const profileImageUrl = review.user?.profileImage || '';
                    const profileImage = profileImageUrl
                        ? `<img src="${profileImageUrl}" style="width: 100%; height: 100%; object-fit: cover;" class="rounded-circle" />`
                        : userInitials;
                    
                    const isLiked = review.votedUsers.findIndex(id => id === currentUserId );

                    return `
                        <div class="review-item p-3 mb-3 border rounded">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <div class="reviewer-info d-flex align-items-center">
                                    <div class="avatar me-2">
                                        <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                                            ${profileImage}
                                        </div>
                                    </div>
                                    <div>
                                        <h6 class="mb-0">${review.user?.username || 'Anonymous'}</h6>
                                        <div class="text-muted small">${review.verifiedPurchase ? 'Verified Purchase' : ''}</div>
                                    </div>
                                </div>
                                <div class="review-date text-muted small">${reviewDate}</div>
                            </div>
                            <div class="rating mb-2">
                                ${starRating}
                                <span class="ms-1 fw-bold">${review.rating.toFixed(1)}</span>
                            </div>
                            <h5 class="review-title mb-2">${review.title}</h5>
                            <div class="review-content mb-3">
                                <p>${review.feedback}</p>
                            </div>
                            <div class="d-flex align-items-center justify-content-between review-actions">
                                <button class="btn btn-sm btn-outline-secondary helpful-btn ${isLiked !== -1  ? "active" : "" } " ${!currentUserId ? "disabled" : "" } data-id="${review._id}">
                                    <i class="far fa-thumbs-up me-1"></i> Helpful (${review.votedUsers.length }) 
                                </button>
                                ${currentUserId === review.user?._id ? `
                                    <div class="review-owner-actions">
                                        <button class="btn btn-sm btn-outline-primary me-2 edit-review-btn " 
                                        data-bs-toggle="modal" 
                                        data-bs-target="#editReviewModal" 
                                        data-id="${review._id}" 
                                        data-rating="${review.rating}" 
                                        data-title="${review.title}" 
                                        data-feedback="${review.feedback}" >
                                            <i class="fas fa-edit me-1"></i> Edit
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger delete-review-btn" 
                                            data-bs-toggle="modal" data-bs-target="#deleteReviewModal" 
                                            data-id="${review._id}">
                                            <i class="fas fa-trash-alt me-1"></i> Delete
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
                
                // Add the new reviews to the list
                if (resetList) {
                    reviewList.innerHTML = reviewsHTML;
                } else {
                    reviewList.innerHTML += reviewsHTML;
                }
                
                // Set up helpful vote buttons
                setupHelpfulButtons();
                
                // Update load more button visibility
                loadMoreBtn.style.display = hasMoreReviews ? 'inline-block' : 'none';
            } else if (resetList) {
                // No reviews found
                reviewList.innerHTML = `
                    <div class="alert alert-info">
                        No reviews found for this product. Be the first to write a review!
                    </div>
                `;
                loadMoreBtn.style.display = 'none';
            }
            
            // Reset button state
            if (loadMoreBtn) {
                loadMoreBtn.innerHTML = '<i class="fas fa-spinner me-2"></i> Load More Reviews';
            }
            
        } catch (error) {
            console.error('Error fetching reviews:', error);
            Swal.fire({ 
                icon: 'error', 
                title: 'Error', 
                text: error.message || 'Failed to load reviews' 
            });
        } finally {
            isLoading = false;
        }
    }

    //  generate star 
    function generateStarRating(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                stars += '<i class="fas fa-star text-warning"></i>';
            } else if (i - 0.5 <= rating) {
                stars += '<i class="fas fa-star-half-alt text-warning"></i>';
            } else {
                stars += '<i class="far fa-star text-warning"></i>';
            }
        }
        return stars;
    }

    setupHelpfulButtons() 

    // vote like
    function setupHelpfulButtons() {
        const helpfulButtons = document.querySelectorAll('.helpful-btn');
        helpfulButtons.forEach(button => {
            button.addEventListener('click', async function() {
                reviewId = button.getAttribute('data-id');
                 
                try {
                    const response = await fetch(`/product/review/like/${reviewId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const data = await response.json();
                    
                    if (!response.ok || !data.success) {
                        displayFormErrors(reviewForm, data.errors);
                        Swal.fire({ 
                            icon: "error", title:"Error", text:data.message || 'Failed to load reviews', 
                            showConfirmButton: "OK",timer:1500, timerProgressBar: true
                        })
                        .then(() => {      
                            if(data.redirect) window.location = data.redirect
                            else if(data.redirectUrl){
                                location.href = data.redirectUrl;
                            }   
                        })
                    }else {
                        this.innerHTML = `<i class="fas fa-thumbs-up me-1"></i> Helpful (${data.review?.votedUsers?.length})`;
                        this.classList.toggle('active');
                    }

                } catch (error) {
                    console.error('Error voting for review:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.message || 'Failed to vote for this review'
                    });
                }
            });
        });
    }

    // add Form submission
    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) {
        reviewForm.addEventListener('submit',async function(e) {
            e.preventDefault();
            clearErrors(reviewForm);

            const formData = new FormData(reviewForm);
            const jsonData = Object.fromEntries(formData);
            jsonData.rating = selectedRating;

            Object.keys(jsonData).forEach(key => {
                if (typeof jsonData[key] === 'string') {
                    jsonData[key] = jsonData[key].trim();
                }
            });

            try { 
                const response = await fetch(`/product/addReview/${productId}`, {
                    method: 'POST',
                    body: JSON.stringify(jsonData),
                    headers: { 'Content-Type': 'application/json' }
                });

                const data = await response.json();
                if (!response.ok || !data.success) {
                    displayFormErrors(reviewForm, data.errors);
                    Swal.fire({
                            title: 'Error',
                            text:  data.message || 'Invalid form validations..!',
                            icon: 'error',
                            timer: 1200,
                            showConfirmButton: "OK"
                        })
                    .then(()=>{
                        if(data.redirectUrl){
                            location.href = data.redirectUrl;
                        }
                    })
                } else {
                    Swal.fire('Success', 'Address added successfully', 'success')
                        .then(() =>  resetForm(reviewForm)) 
                        .then(()=> location.reload());
                }
            } catch (error) {
                console.error('Add address error:', error);
                Swal.fire('Error', 'Something went wrong: ' + error.message, 'error');
            }
        });
    }

    function resetForm(form){
        form.reset();
        ratingStars.forEach(s => {
            s.classList.remove('fas', 'active');
            s.classList.add('far');
        });
    }

        
});
