import os
from PIL import Image, ImageDraw, ImageFilter

def make_rounded(im, radius=24):
    mask = Image.new('L', im.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), im.size], radius=radius, fill=255)
    result = Image.new('RGBA', im.size, (0, 0, 0, 0))
    result.paste(im, (0, 0), mask=mask)
    return result

def add_shadow(im, offset=(0, 10), blur=20, shadow_color=(0, 0, 0, 160)):
    w, h = im.size
    shadow_size = (w + blur * 2, h + blur * 2)
    shadow = Image.new('RGBA', shadow_size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    draw.rounded_rectangle(
        [(blur + offset[0], blur + offset[1]), (w + blur + offset[0], h + blur + offset[1])],
        radius=24,
        fill=shadow_color
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur // 2))
    shadow.paste(im, (blur, blur), mask=im)
    return shadow, blur

def create_banner():
    # Load images
    im_scanner = Image.open('docs/screenshots/app_scanner.png').convert('RGBA')
    im_kardex = Image.open('docs/screenshots/app_kardex.png').convert('RGBA')

    # Normalize height
    target_h = 880
    w1 = int(im_scanner.width * (target_h / im_scanner.height))
    im_scanner = im_scanner.resize((w1, target_h), Image.Resampling.LANCZOS)

    w2 = int(im_kardex.width * (target_h / im_kardex.height))
    im_kardex = im_kardex.resize((w2, target_h), Image.Resampling.LANCZOS)

    # Round corners
    im_scanner = make_rounded(im_scanner, radius=28)
    im_kardex = make_rounded(im_kardex, radius=28)

    # Canvas dimensions
    padding_x = 40
    gap = 40
    banner_w = padding_x * 2 + w1 + w2 + gap
    banner_h = target_h + 100

    # Gradient background (#0b0f19 to #1e293b)
    banner = Image.new('RGBA', (banner_w, banner_h), (11, 15, 25, 255))
    draw = ImageDraw.Draw(banner)
    
    # Subtle top highlight and border
    draw.rounded_rectangle([(8, 8), (banner_w - 8, banner_h - 8)], radius=24, outline=(40, 50, 75, 255), width=2)

    # Shadow for im_scanner
    s_scanner, blur1 = add_shadow(im_scanner, offset=(0, 12), blur=30)
    pos1 = (padding_x - blur1, 50 - blur1)
    banner.paste(s_scanner, pos1, mask=s_scanner)

    # Shadow for im_kardex
    s_kardex, blur2 = add_shadow(im_kardex, offset=(0, 12), blur=30)
    pos2 = (padding_x + w1 + gap - blur2, 50 - blur2)
    banner.paste(s_kardex, pos2, mask=s_kardex)

    # Save banner
    banner.save('docs/screenshots/app_banner.png', format='PNG', optimize=True)
    print(f"Banner generated successfully: {banner_w}x{banner_h} at docs/screenshots/app_banner.png")

if __name__ == "__main__":
    create_banner()
