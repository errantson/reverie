// Story2 Viewer - Carousel-style story viewer
(function() {
    'use strict';

    const LORE_FARM_API = 'https://lore.farm';
    const WORLD_DOMAIN = 'reverie.house';

    class StoryViewer {
        constructor() {
            this.stories = [];
            this.filteredStories = [];
            this.currentIndex = 0;
            this.currentFilter = 'canon';
            this.currentSort = 'newest';
            this.dreamers = [];
            this.loremasters = [];
            
            this.init();
        }

        async init() {
            console.log('🎬 Story Viewer initializing...');
            
            // Debug footer positioning
            setTimeout(() => {
                const footer = document.getElementById('preview-footer');
                const sidebar = document.querySelector('.story2-sidebar');
                const viewer = document.querySelector('.story2-viewer');
                const container = document.querySelector('.story2-container');
                
                if (footer && sidebar && viewer && container) {
                    const footerRect = footer.getBoundingClientRect();
                    const sidebarRect = sidebar.getBoundingClientRect();
                    const viewerRect = viewer.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    
                    console.log('📐 LAYOUT DEBUG:');
                    console.log('  Container:', {
                        left: containerRect.left,
                        top: containerRect.top,
                        width: containerRect.width,
                        position: window.getComputedStyle(container).position
                    });
                    console.log('  Sidebar:', {
                        left: sidebarRect.left,
                        right: sidebarRect.right,
                        width: sidebarRect.width,
                        actualWidth: sidebar.offsetWidth
                    });
                    console.log('  Viewer:', {
                        left: viewerRect.left,
                        width: viewerRect.width,
                        position: window.getComputedStyle(viewer).position
                    });
                    console.log('  Footer:', {
                        left: footerRect.left,
                        bottom: footerRect.bottom,
                        computedLeft: window.getComputedStyle(footer).left,
                        computedBottom: window.getComputedStyle(footer).bottom,
                        position: window.getComputedStyle(footer).position,
                        parent: footer.parentElement.className
                    });
                    console.log('  Expected footer left:', sidebarRect.right);
                    console.log('  Actual footer left:', footerRect.left);
                    console.log('  Offset error:', footerRect.left - sidebarRect.right);
                }
            }, 500);
            
            // Setup user status listener
            this.setupUserStatus();
            
            // Load dreamers first
            await this.loadDreamers();
            
            // Load loremasters
            await this.loadLoremasters();
            
            // Load stories
            await this.loadStories();
            
            // Setup keyboard navigation
            this.setupKeyboardNav();
        }

        setupUserStatus() {
            // Listen for OAuth profile loaded event
            window.addEventListener('oauth:profile-loaded', (event) => {
                const profile = event.detail;
                this.updateUserDisplay(profile);
            });

            // Check if profile already loaded
            if (window.oauthManager?.profile) {
                this.updateUserDisplay(window.oauthManager.profile);
            } else {
                // Show guest state
                this.showGuestState();
            }
        }

        updateUserDisplay(profile) {
            const loading = document.getElementById('sidebar-loading');
            const guest = document.getElementById('sidebar-guest');
            const user = document.getElementById('sidebar-user');
            
            if (!profile || !profile.did) {
                this.showGuestState();
                return;
            }

            // Hide loading/guest, show user
            loading.style.display = 'none';
            guest.style.display = 'none';
            user.style.display = 'flex';

            // Get dreamer info if available
            const dreamer = this.dreamers.find(d => d.did === profile.did);
            
            const avatar = dreamer?.avatar || profile.avatar || '/assets/icon_face.png';
            const name = dreamer?.name || profile.displayName || profile.handle;
            const handle = profile.handle;

            document.getElementById('sidebar-avatar').src = avatar;
            document.getElementById('sidebar-user-name').textContent = name;
            document.getElementById('sidebar-user-handle').textContent = `@${handle}`;
        }

        showGuestState() {
            const loading = document.getElementById('sidebar-loading');
            const guest = document.getElementById('sidebar-guest');
            const user = document.getElementById('sidebar-user');

            loading.style.display = 'none';
            user.style.display = 'none';
            guest.style.display = 'flex';
        }

        async loadDreamers() {
            try {
                const response = await fetch('/api/dreamers');
                if (response.ok) {
                    this.dreamers = await response.json();
                    console.log(`📚 Loaded ${this.dreamers.length} dreamers`);
                }
            } catch (error) {
                console.error('Error loading dreamers:', error);
            }
        }

        async loadLoremasters() {
            try {
                const response = await fetch(`${LORE_FARM_API}/api/loremasters/${WORLD_DOMAIN}`);
                if (response.ok) {
                    const data = await response.json();
                    this.loremasters = data.loremasters || [];
                    console.log(`👑 Loaded ${this.loremasters.length} loremasters`);
                }
            } catch (error) {
                console.error('Error loading loremasters:', error);
            }
        }

        async loadStories() {
            const loading = document.getElementById('viewer-loading');
            const empty = document.getElementById('viewer-empty');
            const content = document.getElementById('viewer-content');
            
            try {
                // Fetch labels from lore.farm labeler
                console.log('📡 Fetching labels from lore.farm...');
                const response = await fetch(`${LORE_FARM_API}/xrpc/com.atproto.label.queryLabels?uriPatterns=*&limit=300`);
                if (!response.ok) throw new Error('Failed to fetch labels');
                
                const data = await response.json();
                console.log(`📦 Received ${data.labels?.length || 0} total labels`);
                
                // Filter for lore:reverie.house and canon:reverie.house labels
                const relevantLabels = data.labels?.filter(label => {
                    const val = label.val || '';
                    return (val === `lore:${WORLD_DOMAIN}` || val === `canon:${WORLD_DOMAIN}`);
                }) || [];
                
                console.log(`🎯 Found ${relevantLabels.length} relevant labels for ${WORLD_DOMAIN}`);
                
                // Group by URI to get unique posts
                const postMap = new Map();
                for (const label of relevantLabels) {
                    const uri = label.uri;
                    if (!postMap.has(uri)) {
                        postMap.set(uri, {
                            uri: uri,
                            is_canon: false,
                            is_lore: false,
                            indexed_at: label.cts || new Date().toISOString()
                        });
                    }
                    const post = postMap.get(uri);
                    if (label.val === `canon:${WORLD_DOMAIN}`) post.is_canon = true;
                    if (label.val === `lore:${WORLD_DOMAIN}`) post.is_lore = true;
                }
                
                console.log(`📚 Grouped into ${postMap.size} unique posts`);
                
                // Now fetch post details for each unique URI using Bluesky public API
                this.stories = [];
                for (const [uri, labelData] of postMap) {
                    try {
                        // Fetch from Bluesky public API
                        const postResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0`);
                        
                        if (postResponse.ok) {
                            const postData = await postResponse.json();
                            const post = postData.thread?.post;
                            
                            if (post && !postData.thread?.notFound && !postData.thread?.blocked) {
                                const storyData = {
                                    ...labelData,
                                    uri: post.uri,
                                    cid: post.cid,
                                    // Use post.embed (resolved view with full image data)
                                    embed: post.embed || null,
                                    post: post,
                                    text: post.record?.text || '',
                                    author: {
                                        did: post.author?.did || '',
                                        handle: post.author?.handle || '',
                                        displayName: post.author?.displayName || '',
                                        avatar: post.author?.avatar || ''
                                    },
                                    like_count: post.likeCount || 0,
                                    repost_count: post.repostCount || 0,
                                    reply_count: post.replyCount || 0,
                                    viewer: post.viewer || null
                                };
                                
                                // Debug logging for embed data
                                if (post.embed) {
                                    console.log(`📷 Story has embed:`, uri, post.embed.$type || post.embed);
                                }
                                
                                this.stories.push(storyData);
                            }
                        }
                    } catch (err) {
                        console.warn(`Failed to fetch post ${uri}:`, err);
                    }
                }
                
                console.log(`📖 Loaded ${this.stories.length} stories`);
                
                // Update counts
                this.updateCounts();
                
                // Apply filter and sort
                this.applyFilters();
                
                // Render carousel preview
                this.renderCarousel();
                
                // Show first story
                if (this.filteredStories.length > 0) {
                    console.log('✅ Showing viewer content');
                    loading.style.display = 'none';
                    empty.style.display = 'none';
                    content.style.display = 'block';
                    console.log('Viewer content display:', content.style.display);
                    this.showStory(0);
                } else {
                    console.log('⚠️ No filtered stories, showing empty state');
                    loading.style.display = 'none';
                    content.style.display = 'none';
                    empty.style.display = 'flex';
                }
            } catch (error) {
                console.error('Error loading stories:', error);
                loading.innerHTML = '<div class="empty-text">Failed to load stories</div>';
            }
        }

        updateCounts() {
            const canonCount = this.stories.filter(s => s.is_canon).length;
            const allCount = this.stories.length;
            
            document.getElementById('canon-count').textContent = canonCount;
            document.getElementById('all-count').textContent = allCount;
            document.getElementById('total-stories').textContent = allCount;
            document.getElementById('filtered-count').textContent = this.filteredStories.length;
        }

        applyFilters() {
            // Filter
            if (this.currentFilter === 'canon') {
                this.filteredStories = this.stories.filter(s => s.is_canon);
            } else {
                this.filteredStories = [...this.stories];
            }
            
            console.log(`🔍 After filter '${this.currentFilter}': ${this.filteredStories.length} stories`);
            
            // Sort
            if (this.currentSort === 'newest') {
                this.filteredStories.sort((a, b) => {
                    return new Date(b.indexed_at) - new Date(a.indexed_at);
                });
            } else {
                this.filteredStories.sort((a, b) => {
                    return new Date(a.indexed_at) - new Date(b.indexed_at);
                });
            }
            
            this.updateCounts();
        }

        setFilter(filter) {
            this.currentFilter = filter;
            this.currentIndex = 0;
            
            // Update button states
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === filter);
            });
            
            this.applyFilters();
            
            if (this.filteredStories.length > 0) {
                document.getElementById('viewer-empty').style.display = 'none';
                document.getElementById('viewer-content').style.display = 'block';
                this.renderCarousel();
                this.showStory(0);
            } else {
                document.getElementById('viewer-content').style.display = 'none';
                document.getElementById('viewer-empty').style.display = 'flex';
            }
        }

        setSort(sort) {
            this.currentSort = sort;
            
            // Update button states
            document.querySelectorAll('.sort-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.sort === sort);
            });
            
            this.applyFilters();
            this.renderCarousel();
            this.showStory(this.currentIndex);
        }

        renderCarousel() {
            const carouselTrack = document.getElementById('carousel-track');
            if (!carouselTrack) return;

            carouselTrack.innerHTML = '';

            this.filteredStories.forEach((story, index) => {
                const item = document.createElement('div');
                item.className = 'carousel-item';
                if (story.is_canon) item.classList.add('canon');
                if (index === this.currentIndex) item.classList.add('active');

                const dreamer = this.getDreamerByHandle(story.author.handle);
                const avatar = dreamer?.avatar || story.author.avatar || '/assets/icon_face.png';
                
                // Format date
                const date = new Date(story.indexed_at);
                const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                // Get handle
                const handle = story.author.handle.replace('.bsky.social', '');

                item.innerHTML = `
                    <img class="carousel-avatar" src="${avatar}" alt="" onerror="this.src='/assets/icon_face.png'">
                    <div class="carousel-info">
                        <div class="carousel-handle">@${this.escapeHtml(handle)}</div>
                        <div class="carousel-date">${formattedDate}</div>
                    </div>
                `;

                item.onclick = () => {
                    this.showStory(index);
                    this.updateCarouselActive(index);
                };

                carouselTrack.appendChild(item);
            });
        }

        updateCarouselActive(index) {
            document.querySelectorAll('.carousel-item').forEach((item, i) => {
                item.classList.toggle('active', i === index);
            });

            // Scroll carousel item into view
            const activeItem = document.querySelectorAll('.carousel-item')[index];
            if (activeItem) {
                activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        showStory(index) {
            if (index < 0 || index >= this.filteredStories.length) {
                console.warn(`❌ Invalid index: ${index} (have ${this.filteredStories.length} stories)`);
                return;
            }
            
            console.log(`🎬 Showing story ${index + 1} of ${this.filteredStories.length}`);
            
            this.currentIndex = index;
            const story = this.filteredStories[index];
            
            console.log('Story data:', story);
            
            // Update current index display
            document.getElementById('current-index').textContent = index + 1;
            
            // Update timeline position counters
            const timelineCurrent = document.getElementById('timeline-current');
            const timelineTotal = document.getElementById('timeline-total');
            if (timelineCurrent) timelineCurrent.textContent = index + 1;
            if (timelineTotal) timelineTotal.textContent = this.filteredStories.length;
            
            // Update author
            const dreamer = this.getDreamerByHandle(story.author.handle);
            const avatar = dreamer?.avatar || story.author.avatar || '/assets/icon_face.png';
            const name = dreamer?.name || story.author.displayName || story.author.handle;
            
            document.getElementById('author-avatar').src = avatar;
            document.getElementById('author-avatar').onerror = function() {
                this.src = '/assets/icon_face.png';
            };
            document.getElementById('author-name').textContent = name;
            document.getElementById('author-handle').textContent = `@${story.author.handle}`;
            
            // Update date with datetime attribute for accessibility
            const date = new Date(story.indexed_at);
            const dateElement = document.getElementById('story-date');
            dateElement.textContent = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            dateElement.setAttribute('datetime', story.indexed_at);
            
            // Update badges
            const badgesHtml = [];
            if (story.is_canon) {
                badgesHtml.push('<span class="badge-tag canon-tag">canon</span>');
            }
            badgesHtml.push('<span class="badge-tag lore-tag">lore</span>');
            document.getElementById('story-badges').innerHTML = badgesHtml.join('');
            
            // Render content: image with overlay OR text-only
            const contentContainer = document.getElementById('story-content-main');
            
            // Check for embedded images
            const embed = story.embed || story.post?.embed;
            console.log('🔍 Checking embed:', { 
                hasEmbed: !!embed, 
                embedType: embed?.$type,
                hasImages: !!embed?.images,
                imageCount: embed?.images?.length,
                fullEmbed: embed
            });
            const hasImage = (embed?.images && embed.images.length > 0) || (embed?.$type === 'app.bsky.embed.images#view' && embed?.images);
            
            if (hasImage) {
                // Render image with text overlay
                const imgObj = embed.images[0];
                const imgUrl = imgObj.thumb || imgObj.fullsize;
                const imgAlt = imgObj.alt || 'Story image';
                const escapedAlt = imgAlt.replace(/'/g, "\\'");

                // Format text for overlay
                const rawTextHtml = this.formatText(story.text) || '';
                const overlayText = rawTextHtml.replace(/^<p>/, '').replace(/<\/p>$/, '');

                // Render image with text overlay (if text exists)
                let imageHtml;
                if (story.text && story.text.trim().length > 0) {
                    imageHtml = `
                        <div class="activity-image-container">
                            <img src="${imgUrl}" alt="${this.escapeHtml(imgAlt)}" class="activity-image" onclick="showImageShadowbox('${imgUrl}', '${escapedAlt}')">
                            <div class="activity-text-overlay">
                                <div class="activity-text-overlay-content">
                                    <div class="activity-text">${overlayText}</div>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    imageHtml = `
                        <div class="activity-image-container">
                            <img src="${imgUrl}" alt="${this.escapeHtml(imgAlt)}" class="activity-image" onclick="showImageShadowbox('${imgUrl}', '${escapedAlt}')">
                        </div>
                    `;
                }

                contentContainer.innerHTML = imageHtml;
                console.log('📷 Image rendered with overlay:', imgUrl);
            } else {
                // No image - render text-only in prose format
                const formattedText = this.formatText(story.text);
                contentContainer.innerHTML = `<div class="story-prose">${formattedText}</div>`;
                console.log('📝 Text-only story rendered');
            }
            
            // Update original link
            const postUri = story.uri.replace('at://', 'https://bsky.app/profile/').replace('/app.bsky.feed.post/', '/post/');
            document.getElementById('view-original').href = postUri;
            
            // Update interactive action buttons
            const likeBtn = document.getElementById('like-btn');
            const repostBtn = document.getElementById('repost-btn');
            const replyBtn = document.getElementById('reply-btn');
            
            // Handle both story.viewer and story.post.viewer structures
            const viewer = story.viewer || story.post?.viewer || {};
            const isLiked = viewer.like ? true : false;
            const isReposted = viewer.repost ? true : false;
            const likeCount = story.like_count || 0;
            const repostCount = story.repost_count || 0;
            const replyCount = story.reply_count || 0;
            
            // Get CID from either location
            const cid = story.cid || story.post?.cid || '';
            
            // Update like button
            likeBtn.dataset.uri = story.uri;
            likeBtn.dataset.cid = cid;
            likeBtn.dataset.liked = isLiked;
            likeBtn.classList.toggle('liked', isLiked);
            likeBtn.title = isLiked ? 'Unlike this post' : 'Like this post';
            likeBtn.querySelector('.action-count').textContent = likeCount;
            likeBtn.onclick = () => this.handleLike(story.uri, cid, isLiked, likeBtn);
            
            // Update repost button
            repostBtn.dataset.uri = story.uri;
            repostBtn.dataset.cid = cid;
            repostBtn.dataset.reposted = isReposted;
            repostBtn.classList.toggle('reposted', isReposted);
            repostBtn.title = isReposted ? 'Undo repost' : 'Repost to your timeline';
            repostBtn.querySelector('.action-count').textContent = repostCount;
            repostBtn.onclick = () => this.handleRepost(story.uri, cid, isReposted, repostBtn);
            
            // Update reply button
            const truncatedText = story.text.substring(0, 30) + (story.text.length > 30 ? '...' : '');
            replyBtn.dataset.uri = story.uri;
            replyBtn.dataset.cid = story.post?.cid || story.cid || '';
            replyBtn.dataset.handle = story.author.handle;
            replyBtn.dataset.displayname = name;
            replyBtn.dataset.text = truncatedText;
            replyBtn.querySelector('.action-count').textContent = replyCount;
            replyBtn.onclick = () => this.handleReply(story.uri, replyBtn.dataset.cid, story.author.handle, name, truncatedText);
            
            // Update nav button states
            document.getElementById('nav-prev').disabled = index === 0;
            document.getElementById('nav-next').disabled = index === this.filteredStories.length - 1;
            
            // Update carousel active state
            this.updateCarouselActive(index);
        }

        formatText(text) {
            if (!text) return '';
            
            // Escape HTML
            const escapeHtml = (str) => {
                const div = document.createElement('div');
                div.textContent = str;
                return div.innerHTML;
            };
            
            // Split into paragraphs and format each
            return text.split('\n\n').map(para => {
                let formatted = escapeHtml(para);
                
                // Linkify handles
                formatted = formatted.replace(
                    /@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?/g,
                    (match) => {
                        const handle = match.substring(1);
                        const dreamer = this.getDreamerByHandle(handle);
                        if (dreamer) {
                            return `<a href="/dreamer?did=${encodeURIComponent(dreamer.did)}" style="color: #734ba1; font-weight: 600; text-decoration: none;">${match}</a>`;
                        }
                        return `<a href="https://bsky.app/profile/${handle}" target="_blank" style="color: #734ba1; font-weight: 600; text-decoration: none;">${match}</a>`;
                    }
                );
                
                // Linkify URLs
                formatted = formatted.replace(
                    /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?/g,
                    (match) => {
                        let url = match;
                        if (!url.startsWith('http')) url = 'https://' + url;
                        return `<a href="${url}" target="_blank" style="color: #734ba1; font-weight: 600; text-decoration: none;">${match}</a>`;
                    }
                );
                
                return `<p>${formatted}</p>`;
            }).join('');
        }

        getDreamerByHandle(handle) {
            if (!handle) return null;
            const normalized = handle.toLowerCase().replace('@', '');
            return this.dreamers.find(d => d.handle && d.handle.toLowerCase() === normalized);
        }

        prev() {
            if (this.currentIndex > 0) {
                this.showStory(this.currentIndex - 1);
            }
        }

        next() {
            if (this.currentIndex < this.filteredStories.length - 1) {
                this.showStory(this.currentIndex + 1);
            }
        }

        setupKeyboardNav() {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') {
                    this.prev();
                } else if (e.key === 'ArrowRight') {
                    this.next();
                }
            });
        }

        handleShareClick() {
            // Open Bluesky compose with pre-filled text
            const text = encodeURIComponent('Check out the stories at Reverie House!\n\nhttps://reverie.house/story\n\n#lore #ReverieHouse');
            window.open(`https://bsky.app/intent/compose?text=${text}`, '_blank');
        }

        showHowItWorks() {
            const widget = new HowToLore();
            widget.setData(this.loremasters, this.dreamers);
            widget.show();
        }

        async handleLike(uri, cid, isCurrentlyLiked, button) {
            if (!window.atprotoInteractions) {
                console.error('❌ [Like] AT Protocol interactions utility not loaded');
                alert('Unable to like post. Please refresh the page.');
                return;
            }

            const session = window.atprotoInteractions.getSession();
            if (!session) {
                if (typeof triggerLogin === 'function') {
                    triggerLogin();
                } else {
                    alert('Please log in to like posts');
                }
                return;
            }

            if (!cid) {
                console.error('❌ [Like] No CID provided for post:', uri);
                alert('Cannot like post: missing post identifier');
                return;
            }

            try {
                button.disabled = true;
                
                if (isCurrentlyLiked) {
                    await window.atprotoInteractions.unlikePost(uri);
                    button.classList.remove('liked');
                    button.dataset.liked = 'false';
                    button.title = 'Like this post';
                    const count = parseInt(button.querySelector('.action-count').textContent) || 0;
                    button.querySelector('.action-count').textContent = Math.max(0, count - 1);
                } else {
                    await window.atprotoInteractions.likePost(uri, cid);
                    button.classList.add('liked');
                    button.dataset.liked = 'true';
                    button.title = 'Unlike this post';
                    const count = parseInt(button.querySelector('.action-count').textContent) || 0;
                    button.querySelector('.action-count').textContent = count + 1;
                }
            } catch (error) {
                console.error('❌ [Like] Error:', error);
                alert(`Failed to ${isCurrentlyLiked ? 'unlike' : 'like'} post: ${error.message}`);
            } finally {
                button.disabled = false;
            }
        }

        async handleRepost(uri, cid, isCurrentlyReposted, button) {
            if (!window.atprotoInteractions) {
                alert('Unable to repost. Please refresh the page.');
                return;
            }

            const session = window.atprotoInteractions.getSession();
            if (!session) {
                if (typeof triggerLogin === 'function') {
                    triggerLogin();
                } else {
                    alert('Please log in to repost');
                }
                return;
            }

            if (!cid) {
                alert('Cannot repost: missing post identifier');
                return;
            }

            try {
                button.disabled = true;
                
                if (isCurrentlyReposted) {
                    await window.atprotoInteractions.unrepost(uri);
                    button.classList.remove('reposted');
                    button.dataset.reposted = 'false';
                    button.title = 'Repost to your timeline';
                    const count = parseInt(button.querySelector('.action-count').textContent) || 0;
                    button.querySelector('.action-count').textContent = Math.max(0, count - 1);
                } else {
                    await window.atprotoInteractions.repost(uri, cid);
                    button.classList.add('reposted');
                    button.dataset.reposted = 'true';
                    button.title = 'Undo repost';
                    const count = parseInt(button.querySelector('.action-count').textContent) || 0;
                    button.querySelector('.action-count').textContent = count + 1;
                }
            } catch (error) {
                console.error('❌ [Repost] Error:', error);
                alert(`Failed to ${isCurrentlyReposted ? 'unrepost' : 'repost'}: ${error.message}`);
            } finally {
                button.disabled = false;
            }
        }

        handleReply(uri, cid, handle, displayName, text) {
            if (!window.atprotoInteractions) {
                alert('Unable to reply. Please refresh the page.');
                return;
            }

            const session = window.atprotoInteractions.getSession();
            if (!session) {
                if (typeof triggerLogin === 'function') {
                    triggerLogin();
                } else {
                    alert('Please log in to reply');
                }
                return;
            }

            if (!cid) {
                alert('Cannot reply: missing post identifier');
                return;
            }

            window.atprotoInteractions.openReplyDialog(uri, cid, handle, displayName, text, (newReplyCount) => {
                const replyBtn = document.getElementById('reply-btn');
                if (replyBtn) {
                    replyBtn.querySelector('.action-count').textContent = newReplyCount;
                }
            });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.StoryViewer = new StoryViewer();
        });
    } else {
        window.StoryViewer = new StoryViewer();
    }
})();

