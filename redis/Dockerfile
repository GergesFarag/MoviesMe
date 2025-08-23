FROM redis:7-alpine

# Add custom configuration
COPY redis.conf /usr/local/etc/redis/redis.conf

# Create a non-root user for security
RUN addgroup -S redis-group && adduser -S redis-user -G redis-group

# Change ownership of necessary directories
RUN chown -R redis-user:redis-group /data
RUN chown -R redis-user:redis-group /usr/local/etc/redis

# Switch to non-root user
USER redis-user

# Expose Redis port
EXPOSE 6379

# Use custom configuration
CMD ["redis-server", "/usr/local/etc/redis/redis.conf"]