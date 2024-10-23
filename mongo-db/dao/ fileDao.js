// fileDao.js
const File = require('../models/File');
const logger = require('../../utils/logger');

class FileDao {
   /**
    * Create new file entry
    */
   async createFile(fileData) {
       try {
           const file = new File({
               fileId: fileData.fileId,
               magnetLink: fileData.magnetLink,
               name: fileData.name,
               size: fileData.size,
               mimeType: fileData.mimeType,
               hash: fileData.hash,
               encryptionProof: fileData.encryptionProof,
               owner: fileData.owner,
               chunks: fileData.chunks
           });

           await file.save();
           logger.info(`File created with ID: ${file.fileId}`);
           return file;

       } catch (error) {
           logger.error('Failed to create file:', error);
           throw error;
       }
   }

   /**
    * Get file by ID
    */
   async getFileById(fileId) {
       try {
           return await File.findOne({ fileId });
       } catch (error) {
           logger.error(`Failed to get file ${fileId}:`, error);
           throw error;
       }
   }

   /**
    * Update file status
    */
   async updateFileStatus(fileId, status, error = null) {
       try {
           const update = { status };
           if (error) update.error = error;

           return await File.findOneAndUpdate(
               { fileId },
               update,
               { new: true }
           );
       } catch (error) {
           logger.error(`Failed to update file status ${fileId}:`, error);
           throw error;
       }
   }

   /**
    * Share file with user
    */
   async shareFile(fileId, address, permissions, expiresAt = null) {
       try {
           const file = await File.findOne({ fileId });
           if (!file) throw new Error('File not found');

           await file.share(address, permissions, expiresAt);
           return file;

       } catch (error) {
           logger.error(`Failed to share file ${fileId}:`, error);
           throw error;
       }
   }

   /**
    * Get user's files
    */
   async getUserFiles(address, options = {}) {
       try {
           const { offset = 0, limit = 20 } = options;

           return await File.find({
               $or: [
                   { owner: address },
                   { 'sharedWith.address': address }
               ]
           })
               .sort({ createdAt: -1 })
               .skip(offset)
               .limit(limit);

       } catch (error) {
           logger.error(`Failed to get files for user ${address}:`, error);
           throw error;
       }
   }

   /**
    * Update torrent stats
    */
   async updateTorrentStats(fileId, seeders, leechers) {
       try {
           const file = await File.findOne({ fileId });
           if (!file) throw new Error('File not found');

           await file.updateStats(seeders, leechers);
           return file;

       } catch (error) {
           logger.error(`Failed to update torrent stats ${fileId}:`, error);
           throw error;
       }
   }
}
