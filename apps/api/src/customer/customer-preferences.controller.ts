/**
 * ZYRA — Customer Preferences & Consent Controller
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CustomerPreferencesService } from './customer-preferences.service';
import {
  type CustomerPreferences,
  type PreferencesUpdateDto,
  type ConsentRecordDto,
} from './customer-preferences.service';

@Controller('customers')
export class CustomerPreferencesController {
  constructor(private readonly prefsService: CustomerPreferencesService) {}

  @Get(':id/preferences')
  getPreferences(@Param('id') id: string): Promise<CustomerPreferences> {
    return this.prefsService.getPreferences(id);
  }

  @Patch(':id/preferences')
  updatePreferences(
    @Param('id') id: string,
    @Body() dto: PreferencesUpdateDto,
  ): Promise<CustomerPreferences> {
    return this.prefsService.updatePreferences(id, dto);
  }

  @Get(':id/consent')
  getConsent(@Param('id') id: string) {
    return this.prefsService.getConsent(id);
  }

  @Post(':id/consent')
  recordConsent(@Param('id') id: string, @Body() dto: ConsentRecordDto) {
    return this.prefsService.recordConsent(id, dto);
  }

  @Get(':id/export')
  async exportData(@Param('id') id: string) {
    const data = await this.prefsService.exportCustomerData(id);
    return {
      ...data,
      // Return as a JSON-serializable blob for the admin UI
    };
  }
}
