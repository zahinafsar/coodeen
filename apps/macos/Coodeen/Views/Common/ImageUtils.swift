import AppKit
import SwiftUI
import UniformTypeIdentifiers

enum ImageUtils {
    static func dataURL(from data: Data, mime: String) -> String {
        "data:\(mime);base64,\(data.base64EncodedString())"
    }

    static func pngDataURL(from image: NSImage) -> String? {
        guard
            let tiff = image.tiffRepresentation,
            let rep = NSBitmapImageRep(data: tiff),
            let png = rep.representation(using: .png, properties: [:])
        else {
            return nil
        }
        return dataURL(from: png, mime: "image/png")
    }

    static func mime(forPath path: String) -> String {
        let ext = URL(fileURLWithPath: path).pathExtension
        if let type = UTType(filenameExtension: ext), let mime = type.preferredMIMEType {
            return mime
        }
        return "image/png"
    }

    static func dataURL(fromFile url: URL) -> String? {
        guard let data = try? Data(contentsOf: url) else {
            return nil
        }
        return dataURL(from: data, mime: mime(forPath: url.path))
    }

    static func image(fromDataURL string: String) -> NSImage? {
        guard string.hasPrefix("data:"), let comma = string.firstIndex(of: ",") else {
            return nil
        }
        let payload = String(string[string.index(after: comma)...])
        guard let data = Data(base64Encoded: payload, options: .ignoreUnknownCharacters) else {
            return nil
        }
        return NSImage(data: data)
    }

    static func fetchImageDataURL(_ urlString: String) async -> String? {
        guard let url = URL(string: urlString) else {
            return nil
        }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                return nil
            }
            let contentType = http.value(forHTTPHeaderField: "Content-Type") ?? ""
            if !contentType.hasPrefix("image/") {
                return nil
            }
            let mime = contentType.split(separator: ";").first.map(String.init) ?? "image/png"
            return dataURL(from: data, mime: mime)
        } catch {
            return nil
        }
    }
}

struct AttachmentImage: View {
    let source: String
    var maxHeight: CGFloat = 192

    var body: some View {
        if let image = ImageUtils.image(fromDataURL: source) {
            Image(nsImage: image)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(maxHeight: maxHeight)
                .clipShape(RoundedRectangle(cornerRadius: Palette.radiusSm))
        } else if let url = URL(string: source) {
            AsyncImage(url: url) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fit)
            } placeholder: {
                ProgressView().controlSize(.small)
            }
            .frame(maxHeight: maxHeight)
            .clipShape(RoundedRectangle(cornerRadius: Palette.radiusSm))
        }
    }
}
