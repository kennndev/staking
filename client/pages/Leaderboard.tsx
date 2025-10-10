import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Crown, Users, Gamepad2, Target, Shield } from "lucide-react";
import { useStaking } from "@/contexts/StakingContext";
import { submitScore } from "@/utils/leaderboard";

interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  score: number;
  gamesPlayed: number;
  gameType: 'cyber-defense' | 'pop-pop' | 'global';
  displayName: string;
}

interface LeaderboardData {
  cyberDefense: LeaderboardEntry[];
  popPop: LeaderboardEntry[];
  global: LeaderboardEntry[];
}

export default function Leaderboard() {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData>({
    cyberDefense: [],
    popPop: [],
    global: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("global");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { walletAddress } = useStaking();

  useEffect(() => {
    fetchLeaderboardData();
  }, []);

  const fetchLeaderboardData = async () => {
    try {
      console.log('📊 [LEADERBOARD] Fetching leaderboard data...');
      setIsLoading(true);
      const response = await fetch('/api/leaderboard');
      console.log('📥 [LEADERBOARD] API response status:', response.status);
      
      if (!response.ok) {
        console.log('❌ [LEADERBOARD] API request failed with status:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ [LEADERBOARD] Leaderboard data received:', data);
      setLeaderboardData(data);
    } catch (error) {
      console.error('❌ [LEADERBOARD] Failed to fetch leaderboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testSubmitScore = async () => {
    if (!walletAddress) {
      console.log('❌ [TEST] No wallet address available');
      return;
    }

    try {
      setIsSubmitting(true);
      console.log('🧪 [TEST] Submitting test score...');
      
      const result = await submitScore(walletAddress, Math.floor(Math.random() * 1000) + 100, 'cyber-defense');
      
      if (result.success) {
        console.log('✅ [TEST] Score submitted successfully!', result);
        // Refresh leaderboard data
        await fetchLeaderboardData();
      } else {
        console.log('❌ [TEST] Score submission failed:', result.message);
      }
    } catch (error) {
      console.error('❌ [TEST] Error submitting test score:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatWalletAddress = (address: string) => {
    if (!address) return 'Unknown';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getGameIcon = (gameType: string) => {
    switch (gameType) {
      case 'cyber-defense':
        return <Shield className="w-4 h-4" />;
      case 'pop-pop':
        return <Target className="w-4 h-4" />;
      default:
        return <Gamepad2 className="w-4 h-4" />;
    }
  };

  const LeaderboardTable = ({ entries, gameType }: { entries: LeaderboardEntry[], gameType: string }) => (
    <div className="space-y-2">
      {entries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No scores yet. Be the first to play!
        </div>
      ) : (
        entries.map((entry, index) => (
          <Card 
            key={`${entry.walletAddress}-${index}`}
            className={`transition-all duration-200 hover:shadow-md ${
              entry.walletAddress === walletAddress 
                ? 'ring-2 ring-primary bg-primary/5' 
                : ''
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-8">
                    {getRankIcon(entry.rank)}
                  </div>
                  <div className="flex items-center space-x-2">
                    {getGameIcon(gameType)}
                    <div>
                      <div className="font-semibold">
                        {formatWalletAddress(entry.walletAddress)}
                        {entry.walletAddress === walletAddress && (
                          <Badge variant="secondary" className="ml-2 text-xs">You</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {entry.gamesPlayed} games played
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {entry.score.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">points</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="container py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-12">
      <header className="text-center mb-12">
        <div className="flex items-center justify-center mb-4">
          <Trophy className="w-12 h-12 text-primary mr-4" />
          <h1 className="text-4xl md:text-6xl font-extrabold">
            <span className="text-gradient">Leaderboard</span>
          </h1>
        </div>
        <p className="text-foreground/80 max-w-2xl mx-auto text-lg">
          Compete with other players and climb the ranks! See who's dominating each game.
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="global" className="flex items-center space-x-2">
            <Trophy className="w-4 h-4" />
            <span>Global</span>
          </TabsTrigger>
          <TabsTrigger value="cyber-defense" className="flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span>Cyber Defense</span>
          </TabsTrigger>
          <TabsTrigger value="pop-pop" className="flex items-center space-x-2">
            <Target className="w-4 h-4" />
            <span>Pop Pop</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="w-6 h-6 text-primary" />
                <span>Global Leaderboard</span>
              </CardTitle>
              <p className="text-muted-foreground">
                Top performers across all games. Only the best score from each player is shown.
              </p>
            </CardHeader>
            <CardContent>
              <LeaderboardTable entries={leaderboardData.global} gameType="global" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cyber-defense">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-6 h-6 text-primary" />
                <span>Cyber Defense Leaderboard</span>
              </CardTitle>
              <p className="text-muted-foreground">
                Defend your base and climb the ranks in Cyber Defense!
              </p>
            </CardHeader>
            <CardContent>
              <LeaderboardTable entries={leaderboardData.cyberDefense} gameType="cyber-defense" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pop-pop">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="w-6 h-6 text-primary" />
                <span>Pop Pop Leaderboard</span>
              </CardTitle>
              <p className="text-muted-foreground">
                Pop the right balloons and build your streak in Pop Pop!
              </p>
            </CardHeader>
            <CardContent>
              <LeaderboardTable entries={leaderboardData.popPop} gameType="pop-pop" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-12 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          Leaderboards update in real-time. Play games to see your score appear!
        </p>
        
        {/* Test Button - Remove this in production */}
        {walletAddress && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
            <p className="text-yellow-400 text-sm mb-2">🧪 Test Mode - Submit Test Score</p>
            <Button 
              onClick={testSubmitScore} 
              disabled={isSubmitting}
              variant="outline"
              className="bg-yellow-500/20 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/30"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Test Score'}
            </Button>
            <p className="text-xs text-yellow-400/70 mt-2">
              This will submit a random score to test the leaderboard system
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
