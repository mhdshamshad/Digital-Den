function getSiteBaseUrl() {
    const host = process.env.HOST;
    if (!host) {
        throw new Error("HOST is not configured");
    }

    const protocol = process.env.NODE_ENV === "production" ? "https:" : "http:";
    const baseUrl = new URL(host.includes("://") ? host : `${protocol}//${host}`);

    if (process.env.NODE_ENV !== "production" && !baseUrl.port && process.env.PORT) {
        baseUrl.port = process.env.PORT;
    }

    return baseUrl.origin;
}

module.exports = { getSiteBaseUrl };
