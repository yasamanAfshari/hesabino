import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/challenges')
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Get()
  async getOverview(@Req() req: any) {
    return this.challengesService.getOverview(req.user.userId);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateChallengeDto) {
    return this.challengesService.create(req.user.userId, dto);
  }

  @Post(':id/cancel')
  async cancel(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.challengesService.cancel(req.user.userId, id);
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChallengeDto,
  ) {
    return this.challengesService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.challengesService.remove(req.user.userId, id);
  }
}
