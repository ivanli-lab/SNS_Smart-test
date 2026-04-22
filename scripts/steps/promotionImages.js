/**
 * Promotion 圖片檢查
 * @param {import('playwright').Page} page
 * @param {string} timestamp
 */
const path = require('path');
async function checkPromotionImages(page, timestamp) {
  console.log('開始 Promotion 圖片檢查...');
  
  try {
    await page.waitForTimeout(1000);
    
    // 滾動到 Promotion 標題
    console.log('正在尋找並滾動到 Promotion 標題...');
    try {
      // 先獲取頁面上的所有標題資訊
      const titleInfo = await page.evaluate(() => {
        const titles = Array.from(document.querySelectorAll('div[data-title="true"]'));
        const promo = titles.find(el => (el.innerText || el.textContent || '').trim().toLowerCase() === 'promotion');
        if (promo) {
          const rect = promo.getBoundingClientRect();
          return { found: true, tagName: promo.tagName, text: promo.innerText, x: rect.x, y: rect.y, top: rect.top };
        }
        
        // Fallback to span
        const spans = Array.from(document.querySelectorAll('span'));
        const spanPromo = spans.find(el => (el.innerText || el.textContent || '').trim().toLowerCase() === 'promotion');
        if (spanPromo) {
          const rect = spanPromo.getBoundingClientRect();
          return { found: true, tagName: 'SPAN', text: spanPromo.innerText, x: rect.x, y: rect.y, top: rect.top, isFallback: true };
        }
        
        return { found: false };
      });

      if (titleInfo.found) {
        console.log(`找到標題: ${titleInfo.tagName} "${titleInfo.text}" 位於 Y=${Math.round(titleInfo.top)}`);
        
        // 執行滾動
        await page.evaluate(() => {
          const titles = Array.from(document.querySelectorAll('div[data-title="true"], span'));
          const promo = titles.find(el => (el.innerText || el.textContent || '').trim().toLowerCase() === 'promotion');
          if (promo) {
            promo.scrollIntoView({ behavior: 'auto', block: 'center' });
          }
        });
        
        // 檢查滾動後的位置
        const afterScrollInfo = await page.evaluate(() => {
          const titles = Array.from(document.querySelectorAll('div[data-title="true"], span'));
          const promo = titles.find(el => (el.innerText || el.textContent || '').trim().toLowerCase() === 'promotion');
          if (promo) {
            const rect = promo.getBoundingClientRect();
            return { top: rect.top };
          }
          return null;
        });
        
        if (afterScrollInfo) {
          console.log(`滾動後標題位置: Y=${Math.round(afterScrollInfo.top)}`);
        }
        console.log('已執行滾動指令');
      } else {
        console.log('完全找不到包含 Promotion 文字的標題元素');
      }
    } catch (scrollError) {
      console.warn('滾動過程發生錯誤:', scrollError.message);
    }
    
    await page.waitForTimeout(2000); // 增加等待時間，確保滾動完成且圖片加載
    
    // Find Promotion section and check images
    const imageCheckResult = await page.evaluate(() => {
      // Look for Promotion text element (not the entire container)
      const allElements = Array.from(document.querySelectorAll('*'));
      let promotionTextElement = null;
      
      // 優先尋找 <div data-title="true"><span>Promotion</span></div>
      const specificTitle = document.querySelector('div[data-title="true"]');
      if (specificTitle && (specificTitle.innerText || specificTitle.textContent || '').trim().toLowerCase() === 'promotion') {
        promotionTextElement = specificTitle;
      }
      
      if (!promotionTextElement) {
        // Find the element that directly contains "Promotion" text
        for (const el of allElements) {
          const ownText = (el.innerText || el.textContent || '').trim();
          const className = (el.className || '').toString().toLowerCase();
          const id = (el.id || '').toLowerCase();
          
          // Look for element with "Promotion" text (but not too much other text)
          if ((ownText.toLowerCase() === 'promotion' || 
               ownText.toLowerCase().includes('promotion') && ownText.length < 50) ||
              className.includes('promotion') || 
              id.includes('promotion')) {
            if (el.offsetParent !== null) {
              promotionTextElement = el;
              console.log(`Found Promotion text element: ${el.tagName}, text: "${ownText.substring(0, 50)}"`);
              break;
            }
          }
        }
      }
      
      if (!promotionTextElement) {
        console.log('Promotion text element not found');
        return { found: false, reason: 'Promotion text element not found' };
      }
      
      // Find the banner container near the Promotion text
      // Usually it's a sibling or nearby container
      let bannerContainer = null;
      const promotionRect = promotionTextElement.getBoundingClientRect();
      
      // Look for a container below the Promotion text
      for (const el of allElements) {
        const rect = el.getBoundingClientRect();
        
        // Check if element is below Promotion text and reasonably close
        if (rect.top >= promotionRect.bottom && 
            rect.top - promotionRect.bottom < 200 &&
            rect.width > 300 && rect.height > 100) {
          
          const imgs = el.querySelectorAll('img');
          // Look for container with multiple images (banner carousel)
          if (imgs.length >= 2) {
            bannerContainer = el;
            console.log(`Found banner container: ${el.tagName}, images: ${imgs.length}`);
            break;
          }
        }
      }
      
      // If no banner container found, try to find images with "banner" in src
      let images = [];
      if (bannerContainer) {
        images = Array.from(bannerContainer.querySelectorAll('img'));
      } else {
        // Fallback: find all images near Promotion text with "banner" in URL
        console.log('Banner container not found, using fallback method');
        const allImages = Array.from(document.querySelectorAll('img'));
        images = allImages.filter(img => {
          const src = (img.src || '').toLowerCase();
          return src.includes('banner') || src.includes('promotion');
        });
      }
      
      // Filter logic: keep banner-sized images OR broken images
      // Broken images might display as small (< 50x50) but we still want to detect them
      images = images.filter(img => {
        const rect = img.getBoundingClientRect();
        const isBroken = img.complete && img.naturalWidth === 0;
        
        // Keep if: 1) Normal banner size, OR 2) Broken/error image
        return (rect.width > 200 && rect.height > 100) || isBroken;
      });
      
      console.log(`Found ${images.length} banner images after filtering`);
      
      // Remove duplicate images (same src URL)
      const uniqueImages = [];
      const seenUrls = new Set();
      
      for (const img of images) {
        const src = img.src || '';
        // Remove query parameters for comparison (like ?t=timestamp)
        const srcWithoutQuery = src.split('?')[0];
        
        if (!seenUrls.has(srcWithoutQuery)) {
          seenUrls.add(srcWithoutQuery);
          uniqueImages.push(img);
        }
      }
      
      images = uniqueImages;
      console.log(`After removing duplicates: ${images.length} unique banner images`);
      
      if (images.length === 0) {
        return { 
          found: true, 
          hasImages: false, 
          imageCount: 0,
          message: 'Promotion 區域找到但沒有圖片'
        };
      }
      
      const imageDetails = [];
      let brokenCount = 0;
      let loadedCount = 0;
      
      for (const img of images) {
        const rect = img.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        
        // Check if image is broken (naturalWidth is 0 for broken images)
        const isBroken = img.complete && img.naturalWidth === 0;
        const isLoaded = img.complete && img.naturalWidth > 0;
        
        if (isBroken) brokenCount++;
        if (isLoaded) loadedCount++;
        
        imageDetails.push({
          src: img.src ? img.src.substring(0, 100) : 'no src',
          alt: img.alt || 'no alt',
          width: rect.width,
          height: rect.height,
          visible: isVisible,
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          broken: isBroken,
          loaded: isLoaded
        });
      }
      
      return {
        found: true,
        hasImages: true,
        imageCount: images.length,
        loadedCount: loadedCount,
        brokenCount: brokenCount,
        images: imageDetails,
        allImagesOK: brokenCount === 0 && loadedCount === images.length
      };
    });
    
    if (!imageCheckResult.found) {
      console.log('Promotion 區域未找到');
            return {
        found: false,
        message: 'Promotion 區域未找到'
      };
    }
    
    if (!imageCheckResult.hasImages) {
      console.log('Promotion 區域沒有圖片');
      return {
        found: true,
        hasImages: false,
        imageCount: 0,
        message: 'Promotion 區域找到但沒有圖片'
    };
    }
    
    const { imageCount, loadedCount, brokenCount, allImagesOK } = imageCheckResult;
    
    console.log(`Promotion 圖片檢查完成: 總共 ${imageCount} 張，載入成功 ${loadedCount} 張，錯誤 ${brokenCount} 張`);
    
    let message = `找到 ${imageCount} 張圖片`;
    if (allImagesOK) {
      message += '，全部正常載入';
    } else {
      if (brokenCount > 0) {
        message += `，${brokenCount} 張錯誤`;
      }
      if (loadedCount < imageCount) {
        message += `，${imageCount - loadedCount} 張未載入`;
      }
    }
    
    return {
      found: true,
      hasImages: true,
      imageCount: imageCount,
      loadedCount: loadedCount,
      brokenCount: brokenCount,
      allImagesOK: allImagesOK,
      message: message,
      debug: {
        images: imageCheckResult.images
      }
    };
    
  } catch (error) {
    console.error('Promotion 圖片檢查錯誤:', error);
    return {
      found: false,
      error: String(error && error.message || error),
      message: `Promotion 圖片檢查失敗: ${error && error.message || error}`
    };
  }
}

module.exports = checkPromotionImages;
