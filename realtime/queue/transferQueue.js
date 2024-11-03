const Queue = require('bull');
const { EventEmitter } = require('events');
const logger = require('../../utils/logger');

class TransferQueue extends EventEmitter {
    constructor(redisConfig) {
        super();
        this.uploadQueue = new Queue('file-uploads', redisConfig);
        this.downloadQueue = new Queue('file-downloads', redisConfig);
        this.concurrency = 5; // Process 5 transfers simultaneously
        this.initialized = false;
        this.setupQueues();
    }

    /**
     * Set up queues and processors
     */
    setupQueues() {
        // Upload queue processor
        this.uploadQueue.process(this.concurrency, async (job) => {
            try {
                const { file, metadata, isPrivate, recipients } = job.data;
                
                this.emit('upload:started', { 
                    jobId: job.id,
                    metadata 
                });

                // Process upload chunks
                const chunks = await this.processUploadChunks(job);

                // Emit progress events
                job.progress(100);
                this.emit('upload:completed', {
                    jobId: job.id,
                    infoHash: chunks.infoHash
                });

                return chunks;

            } catch (error) {
                logger.error('Upload processing failed:', error);
                this.emit('upload:failed', {
                    jobId: job.id,
                    error: error.message
                });
                throw error;
            }
        });

        // Download queue processor
        this.downloadQueue.process(this.concurrency, async (job) => {
            try {
                const { infoHash, encryptionKey } = job.data;

                this.emit('download:started', { 
                    jobId: job.id,
                    infoHash 
                });

                // Process download chunks
                const file = await this.processDownloadChunks(job);

                // Emit progress events
                job.progress(100);
                this.emit('download:completed', {
                    jobId: job.id,
                    file
                });

                return file;

            } catch (error) {
                logger.error('Download processing failed:', error);
                this.emit('download:failed', {
                    jobId: job.id,
                    error: error.message
                });
                throw error;
            }
        });

        // Add event listeners
        this.setupEventListeners();

        this.initialized = true;
    }

    /**
     * Add file upload to queue
     */
    async addUpload(uploadData) {
        try {
            const job = await this.uploadQueue.add(uploadData, {
                priority: uploadData.priority || 0,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000
                },
                removeOnComplete: false
            });

            logger.info('Upload job added:', { jobId: job.id });
            return job;

        } catch (error) {
            logger.error('Add upload failed:', error);
            throw error;
        }
    }

    /**
     * Add file download to queue
     */
    async addDownload(downloadData) {
        try {
            const job = await this.downloadQueue.add(downloadData, {
                priority: downloadData.priority || 0,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000
                },
                removeOnComplete: false
            });

            logger.info('Download job added:', { jobId: job.id });
            return job;

        } catch (error) {
            logger.error('Add download failed:', error);
            throw error;
        }
    }

    /**
     * Process upload in chunks
     */
    async processUploadChunks(job) {
        const { file, chunkSize = 1024 * 1024 } = job.data;
        const chunks = [];
        let processed = 0;

        for (let i = 0; i < file.length; i += chunkSize) {
            const chunk = file.slice(i, i + chunkSize);
            chunks.push(await this.processChunk(chunk));
            
            processed += chunk.length;
            job.progress((processed / file.length) * 100);
        }

        return chunks;
    }

    /**
     * Process download in chunks
     */
    async processDownloadChunks(job) {
        const { infoHash, encryptionKey } = job.data;
        const chunks = [];
        let processed = 0;
        const totalSize = await this.getTotalSize(infoHash);

        while (processed < totalSize) {
            const chunk = await this.downloadChunk(infoHash, processed);
            chunks.push(chunk);
            
            processed += chunk.length;
            job.progress((processed / totalSize) * 100);
        }

        return Buffer.concat(chunks);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Upload queue events
        this.uploadQueue.on('completed', (job, result) => {
            logger.info('Upload completed:', { jobId: job.id });
        });

        this.uploadQueue.on('failed', (job, error) => {
            logger.error('Upload failed:', { jobId: job.id, error });
        });

        this.uploadQueue.on('stalled', (job) => {
            logger.warn('Upload stalled:', { jobId: job.id });
        });

        // Download queue events
        this.downloadQueue.on('completed', (job, result) => {
            logger.info('Download completed:', { jobId: job.id });
        });

        this.downloadQueue.on('failed', (job, error) => {
            logger.error('Download failed:', { jobId: job.id, error });
        });

        this.downloadQueue.on('stalled', (job) => {
            logger.warn('Download stalled:', { jobId: job.id });
        });
    }

    /**
     * Clean up queues
     */
    async cleanup() {
        await Promise.all([
            this.uploadQueue.close(),
            this.downloadQueue.close()
        ]);
    }
}
